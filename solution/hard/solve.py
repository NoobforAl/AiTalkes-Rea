"""SPOILER - answer key for sample/hard. Decrypts secret.enc without running vault.
Recovered by reverse engineering: ENC_SEED blob, XOR (0xA5 ^ i) decode, FNV-1a 64 -> state | 1,
xorshift64* keystream (top byte), per byte: c = rotl8(p ^ ks, i & 7) + (i * 31) mod 256.
"""
import os, struct, sys

ENC_SEED = bytes([0xf3, 0xc8, 0xd3, 0x8b, 0x98, 0xd8, 0x82, 0xe9, 0xdc, 0x9b, 0x8c, 0xd4])
M = (1 << 64) - 1

def fnv1a(b):
    h = 0xcbf29ce484222325
    for x in b:
        h = ((h ^ x) * 0x100000001b3) & M
    return h

def rotr8(x, n):
    n &= 7
    return ((x >> n) | (x << (8 - n))) & 0xFF if n else x

def decrypt(blob):
    assert blob[:4] == b"VLT1"
    (n,) = struct.unpack("<I", blob[4:8])
    seed = bytes(c ^ (0xA5 ^ i) for i, c in enumerate(ENC_SEED))
    st = fnv1a(seed) | 1
    out = bytearray()
    for i, c in enumerate(blob[8:8 + n]):
        st ^= st >> 12; st ^= (st << 25) & M; st ^= st >> 27
        ks = ((st * 0x2545F4914F6CDD1D) & M) >> 56
        out.append(rotr8((c - i * 31) & 0xFF, i) ^ ks)
    return seed, bytes(out)

if __name__ == "__main__":
    seed, plain = decrypt(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "sample", "hard", "secret.enc"), "rb").read())
    print("seed :", seed)
    print(plain.decode())
