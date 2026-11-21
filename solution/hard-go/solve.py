"""SPOILER - answer key for sample/hard-go (vault-go). Decrypts secret.enc without running the binary.

Recovered by reverse engineering:
  * seed      = MASKED ^ byte(0x5a + 7*i)                      (18 bytes, never a plain string)
  * key       = SHA-256 applied 1000 times to the seed         (real crypto/sha256: the constants are only a KDF)
  * schedule  = state = u64le(key[:8]) | 1; 6 x xorshift64* (12/25/27), round key = high 32 bits
  * cipher    = 64-bit blocks, 6-round Feistel, F alternates mulMix / addMix (itab dispatch, i & 1)
  * whitening = block ^ rotl64(idx * 0x9E3779B97F4A7C15, 17)    (so blocks can be encrypted by parallel goroutines)
  * format    = "GOV1" | u32le length | ciphertext (padded to 8)
Decoy: the "AES-256-GCM key=6b65792d..." banner is never used.
"""
import hashlib
import os
import struct
import sys

MASKED = bytes([0x37, 0x0E, 0x04, 0x0A, 0x5B, 0x14, 0xEA, 0xA6, 0xE6, 0xF1, 0xC5, 0x8A, 0xDA, 0xC0, 0xD2, 0xAD, 0xAF, 0xBD])
M32, M64 = (1 << 32) - 1, (1 << 64) - 1
ROUNDS = 6


def rotl32(x, n):
    return ((x << n) | (x >> (32 - n))) & M32


def rotl64(x, n):
    return ((x << n) | (x >> (64 - n))) & M64


def mul_mix(x, k):
    return (rotl32((x * 0x9E3779B1) & M32 ^ k, 5) + (x >> 3)) & M32


def add_mix(x, k):
    return rotl32(((x + k) & M32) * 0x85EBCA6B & M32, 13) ^ ((x << 7) & M32)


def whiten(i):
    return rotl64((i * 0x9E3779B97F4A7C15) & M64, 17)


def round_keys(seed):
    h = hashlib.sha256(seed).digest()
    for _ in range(999):
        h = hashlib.sha256(h).digest()
    s = struct.unpack("<Q", h[:8])[0] | 1
    rk = []
    for _ in range(ROUNDS):
        s ^= s >> 12
        s ^= (s << 25) & M64
        s ^= s >> 27
        rk.append(((s * 0x2545F4914F6CDD1D) & M64) >> 32)
    return rk


def decrypt_block(ct, idx, rk):
    l, r = ct & M32, ct >> 32  # the encryptor returns r<<32 | l
    for i in reversed(range(ROUNDS)):
        f = mul_mix if i % 2 == 0 else add_mix
        l, r = r ^ f(l, rk[i]), l
    return ((l << 32) | r) ^ whiten(idx)


def decrypt(blob):
    assert blob[:4] == b"GOV1"
    (n,) = struct.unpack("<I", blob[4:8])
    seed = bytes(b ^ ((0x5A + 7 * i) & 0xFF) for i, b in enumerate(MASKED))
    rk = round_keys(seed)
    body = blob[8:]
    out = b"".join(struct.pack("<Q", decrypt_block(struct.unpack("<Q", body[o:o + 8])[0], o // 8, rk)) for o in range(0, len(body), 8))
    return seed, out[:n]


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "..", "sample", "hard-go", "secret.enc")
    seed, plain = decrypt(open(path, "rb").read())
    print("seed :", seed)
    print(plain.decode())
