"""SPOILER - answer key for sample/hard-rust (vault-rs). Decrypts secret.enc without running the binary.

Recovered by reverse engineering:
  * key       = 8 words from a compile-time xorshift32 (13/17/5) seeded with 0x9E3779B9 ^ 0xC0FFEE11;
                word i = rotl32(s * 0x2545F491, 7) ^ (i * 0x01000193)   (folded into constants by rustc)
  * cipher    = ChaCha-shaped stream cipher, but: sigma = Murmur3 constants, rotations 11/9/13/5, 8 rounds
  * state     = sigma[4] | key[8] | counter | nonce[3], nonce = (len, 0xA5A5A5A5, 0x5A5A5A5A)
  * keystream = state after 8 rounds + initial state, little endian, XORed with the data in 64-byte blocks
  * format    = "RSV1" | u32le length | ciphertext (same length)
Decoy: the "ChaCha20-Poly1305 key=6b65792d..." banner is only printed with 9+ arguments.
"""
import os
import struct
import sys

M32 = (1 << 32) - 1
SIGMA = [0x1B873593, 0xCC9E2D51, 0x85EBCA6B, 0xC2B2AE35]


def rotl(x, n):
    return ((x << n) | (x >> (32 - n))) & M32


def derive_key():
    s = 0x9E3779B9 ^ 0xC0FFEE11
    key = []
    for i in range(8):
        s ^= (s << 13) & M32
        s ^= s >> 17
        s ^= (s << 5) & M32
        key.append(rotl((s * 0x2545F491) & M32, 7) ^ ((i * 0x01000193) & M32))
    return key


def qr(s, a, b, c, d):
    s[a] = (s[a] + s[b]) & M32
    s[d] = rotl(s[d] ^ s[a], 11)
    s[c] = (s[c] + s[d]) & M32
    s[b] = rotl(s[b] ^ s[c], 9)
    s[a] = (s[a] + s[b]) & M32
    s[d] = rotl(s[d] ^ s[a], 13)
    s[c] = (s[c] + s[d]) & M32
    s[b] = rotl(s[b] ^ s[c], 5)


def keystream_block(key, counter, nonce):
    init = SIGMA + key + [counter] + nonce
    s = list(init)
    for _ in range(4):
        qr(s, 0, 4, 8, 12); qr(s, 1, 5, 9, 13); qr(s, 2, 6, 10, 14); qr(s, 3, 7, 11, 15)
        qr(s, 0, 5, 10, 15); qr(s, 1, 6, 11, 12); qr(s, 2, 7, 8, 13); qr(s, 3, 4, 9, 14)
    return b"".join(struct.pack("<I", (s[i] + init[i]) & M32) for i in range(16))


def decrypt(blob):
    assert blob[:4] == b"RSV1"
    (n,) = struct.unpack("<I", blob[4:8])
    key = derive_key()
    nonce = [n, 0xA5A5A5A5, 0x5A5A5A5A]
    body = blob[8:8 + n]
    out = bytearray()
    for counter in range(0, len(body), 64):
        ks = keystream_block(key, counter // 64, nonce)
        out += bytes(c ^ k for c, k in zip(body[counter:counter + 64], ks))
    return key, bytes(out)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "..", "sample", "hard-rust", "secret.enc")
    key, plain = decrypt(open(path, "rb").read())
    print("key  :", " ".join(f"{w:08x}" for w in key))
    print(plain.decode())
