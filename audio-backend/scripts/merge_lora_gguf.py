"""
Fast LoRA Merger for GGUF Q8_0 Models (audio.cpp / llama.cpp).
Folds LoRA deltas (W += scale * B @ A) directly into GGUF Q8_0 weights,
producing an instrumental-specialized standalone GGUF model.
"""

import os
import sys
import time
import struct
import json
import argparse
from pathlib import Path
import numpy as np

PROJECTIONS = [
    "self_attn.q_proj",
    "self_attn.k_proj",
    "self_attn.v_proj",
    "self_attn.o_proj",
    "mlp.gate_proj",
    "mlp.up_proj",
    "mlp.down_proj",
]

def read_str(f):
    length = struct.unpack("<Q", f.read(8))[0]
    return f.read(length).decode("utf-8", errors="ignore")

def skip_val(f, vtype):
    sizes = {0:1, 1:1, 2:2, 3:2, 4:4, 5:4, 6:4, 7:1, 10:8, 11:8, 12:8}
    if vtype in sizes:
        f.read(sizes[vtype])
    elif vtype == 8:
        read_str(f)
    elif vtype == 9:
        elem_type = struct.unpack("<I", f.read(4))[0]
        count = struct.unpack("<Q", f.read(8))[0]
        for _ in range(count):
            skip_val(f, elem_type)

def dequant_q8_0(raw_bytes: bytes, ne1: int, ne0: int) -> np.ndarray:
    num_elements = ne0 * ne1
    K = num_elements // 32
    raw_blocks = np.frombuffer(raw_bytes, dtype=np.uint8).reshape(K, 34)
    d = raw_blocks[:, :2].view(np.float16).astype(np.float32)
    qs = raw_blocks[:, 2:].view(np.int8).astype(np.float32)
    return (qs * d).reshape(ne1, ne0)

def quant_q8_0(f32_weights: np.ndarray) -> bytes:
    K = f32_weights.size // 32
    flat = f32_weights.reshape(K, 32)
    max_abs = np.max(np.abs(flat), axis=1, keepdims=True)
    d_new = (max_abs / 127.0).astype(np.float16)
    d_f32 = d_new.astype(np.float32)
    d_f32[d_f32 == 0] = 1.0
    qs_new = np.clip(np.round(flat / d_f32), -128, 127).astype(np.int8)

    out_blocks = np.empty((K, 34), dtype=np.uint8)
    out_blocks[:, :2] = d_new.view(np.uint8)
    out_blocks[:, 2:] = qs_new.view(np.uint8)
    return out_blocks.tobytes()

def load_lora_deltas(lora_path: Path, scale: float = 1.0) -> dict:
    print(f"[merge] Reading LoRA weights from {lora_path.name}...")
    deltas = {}
    with open(lora_path, "rb") as f:
        hlen = struct.unpack("<Q", f.read(8))[0]
        header = json.loads(f.read(hlen).decode("utf-8"))
        base_offset = 8 + hlen

        def get_tensor(name: str) -> np.ndarray:
            info = header[name]
            start, end = info["data_offsets"]
            shape = info["shape"]
            f.seek(base_offset + start)
            raw = f.read(end - start)
            u16 = np.frombuffer(raw, dtype=np.uint16)
            # bfloat16 to float32 bitshift
            return (u16.astype(np.uint32) << 16).view(np.float32).reshape(shape)

        for layer_idx in range(28):
            for proj in PROJECTIONS:
                a_name = f"layers.{layer_idx}.{proj}.lora_A"
                b_name = f"layers.{layer_idx}.{proj}.lora_B"
                if a_name in header and b_name in header:
                    A = get_tensor(a_name) # (rank, in_dim)
                    B = get_tensor(b_name) # (out_dim, rank)
                    # Delta W has shape (out_dim, in_dim)
                    delta = (B @ A) * scale
                    target_gguf_name = f"model_weights/model.layers.{layer_idx}.{proj}.weight"
                    deltas[target_gguf_name] = delta

    print(f"[merge] Computed {len(deltas)} LoRA delta matrices.")
    return deltas

def merge_lora_into_gguf(base_gguf: Path, lora_path: Path, output_gguf: Path, scale: float = 1.0):
    t0 = time.time()
    deltas = load_lora_deltas(lora_path, scale=scale)

    print(f"[merge] Scanning GGUF header of {base_gguf.name}...")
    with open(base_gguf, "rb") as f_in:
        magic = f_in.read(4)
        if magic != b"GGUF":
            raise ValueError(f"Invalid GGUF magic: {magic}")
        version = struct.unpack("<I", f_in.read(4))[0]
        num_tensors = struct.unpack("<Q", f_in.read(8))[0]
        num_kv = struct.unpack("<Q", f_in.read(8))[0]

        alignment = 32
        for _ in range(num_kv):
            key = read_str(f_in)
            vtype = struct.unpack("<I", f_in.read(4))[0]
            if key == "general.alignment":
                alignment = struct.unpack("<I", f_in.read(4))[0]
            else:
                skip_val(f_in, vtype)

        tensor_entries = []
        for i in range(num_tensors):
            name = read_str(f_in)
            dims = struct.unpack("<I", f_in.read(4))[0]
            shape = [struct.unpack("<Q", f_in.read(8))[0] for _ in range(dims)]
            ttype = struct.unpack("<I", f_in.read(4))[0]
            offset = struct.unpack("<Q", f_in.read(8))[0]
            tensor_entries.append({
                "idx": i,
                "name": name,
                "shape": shape,
                "type": ttype,
                "offset": offset,
            })

        meta_end = f_in.tell()
        data_start = (meta_end + alignment - 1) // alignment * alignment

        # Sort tensors by offset in file
        tensor_entries.sort(key=lambda x: x["offset"])

        # Compute byte lengths
        file_size = base_gguf.stat().st_size
        for i, t in enumerate(tensor_entries):
            next_offset = tensor_entries[i + 1]["offset"] if i + 1 < len(tensor_entries) else (file_size - data_start)
            t["byte_len"] = next_offset - t["offset"]

        print(f"[merge] Writing merged model to {output_gguf.name}...")
        os.makedirs(output_gguf.parent, exist_ok=True)
        with open(output_gguf, "wb") as f_out:
            # 1. Copy full metadata header verbatim
            f_in.seek(0)
            f_out.write(f_in.read(data_start))

            merged_count = 0
            # 2. Process tensors in sequential offset order
            for i, t in enumerate(tensor_entries):
                f_in.seek(data_start + t["offset"])
                t_name = t["name"]
                t_len = t["byte_len"]

                if t_name in deltas and t["type"] == 8: # GGML_TYPE_Q8_0
                    ne0, ne1 = t["shape"][0], t["shape"][1]
                    raw_bytes = f_in.read(t_len)
                    dequant = dequant_q8_0(raw_bytes, ne1, ne0)
                    delta = deltas[t_name]

                    if dequant.shape != delta.shape:
                        print(f"[warning] Shape mismatch for {t_name}: {dequant.shape} vs {delta.shape}. Skipping.")
                        f_out.write(raw_bytes)
                        continue

                    # Apply delta
                    merged = dequant + delta
                    new_q8_bytes = quant_q8_0(merged)
                    f_out.write(new_q8_bytes)
                    merged_count += 1

                    if merged_count % 28 == 0 or merged_count == len(deltas):
                        pct = int((merged_count / len(deltas)) * 100)
                        print(f"  [merge] {merged_count}/{len(deltas)} matrices merged ({pct}%)...")
                else:
                    # Stream chunk directly
                    chunk_size = 10 * 1024 * 1024
                    remaining = t_len
                    while remaining > 0:
                        to_read = min(remaining, chunk_size)
                        buf = f_in.read(to_read)
                        f_out.write(buf)
                        remaining -= to_read

    elapsed = time.time() - t0
    print(f"[merge] SUCCESS! Merged {merged_count} AR weights into {output_gguf.name} in {elapsed:.1f}s.")
    print(f"[merge] Output file size: {round(output_gguf.stat().st_size / (1024**3), 2)} GB")

if __name__ == "__main__":
    default_base = Path.home() / ".cache" / "ppt-engraver" / "models" / "yue2-3b-gguf-q8" / "yue2-3b-q8_0.gguf"
    default_lora = Path.home() / ".cache" / "ppt-engraver" / "models" / "yue2-lora-instrumental" / "ar_lora_inst_v3abc.bf16.safetensors"
    default_out = Path.home() / ".cache" / "ppt-engraver" / "models" / "yue2-3b-gguf-q8" / "yue2-3b-inst-q8_0.gguf"

    parser = argparse.ArgumentParser(description="Merge Mothersuperior Instrumental LoRA into YuE2 GGUF Q8_0")
    parser.add_argument("--base", type=Path, default=default_base, help="Base GGUF model path")
    parser.add_argument("--lora", type=Path, default=default_lora, help="LoRA safetensors path")
    parser.add_argument("--output", type=Path, default=default_out, help="Output merged GGUF path")
    parser.add_argument("--scale", type=float, default=1.0, help="LoRA scale factor")

    args = parser.parse_args()
    merge_lora_into_gguf(args.base, args.lora, args.output, args.scale)
