//! cipherbox - HARD demo target #3 for the reverse-engineering talk (Rust; educational, benign).
//! Usage: vault-rs   (no arguments: reads ./secret.txt, writes ./secret.enc)
//!
//! Why it is hard (and different from the C and Go samples):
//!   - release build with LTO + panic=abort + strip -> no symbols, no unwinding tables, one big inlined main
//!   - monomorphised iterator chains / `chunks_mut` -> no tidy "encrypt" function, the loop is fused with the I/O
//!   - &str is (pointer, length)                    -> file names are not NUL-terminated string literals
//!   - key is computed at COMPILE time (const fn)   -> it never exists as a string, only as folded constants
//!   - modified ChaCha: custom constants, rotations 11/9/13/5, 8 rounds -> capa/YARA "ChaCha" rules do not match
//!   - decoys                                       -> a fake "ChaCha20-Poly1305" banner; SIGMA looks like Murmur3 constants
//!   - anti-debug                                   -> if TracerPid != 0 one key word is silently flipped
//!
//! Output format: "RSV1" | u32 little-endian length | ciphertext (same length as the plaintext)

use std::{env, fs, hint::black_box, process};

// file names are fixed on purpose: no command line, so no wrong file name
const IN_FILE: &str = "secret.txt";
const OUT_FILE: &str = "secret.enc";

// decoy: looks like a key, is never used (only printed when called with 9+ arguments)
const BANNER: &str = "cipherbox 2 | ChaCha20-Poly1305 | key=6b65792d6465636f792d3032";

// replaces ChaCha's "expand 32-byte k"; these are the Murmur3 mixing constants
const SIGMA: [u32; 4] = [0x1b87_3593, 0xcc9e_2d51, 0x85eb_ca6b, 0xc2b2_ae35];

// real key material: expanded by the compiler from a 32-bit seed
const fn derive_key() -> [u32; 8] {
    let mut s: u32 = 0x9E37_79B9 ^ 0xC0FF_EE11;
    let mut k = [0u32; 8];
    let mut i = 0;
    while i < 8 {
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        k[i] = s.wrapping_mul(0x2545_F491).rotate_left(7) ^ (i as u32).wrapping_mul(0x0100_0193);
        i += 1;
    }
    k
}
const KEY: [u32; 8] = derive_key();

#[inline(always)]
fn qr(s: &mut [u32; 16], a: usize, b: usize, c: usize, d: usize) {
    s[a] = s[a].wrapping_add(s[b]);
    s[d] = (s[d] ^ s[a]).rotate_left(11);
    s[c] = s[c].wrapping_add(s[d]);
    s[b] = (s[b] ^ s[c]).rotate_left(9);
    s[a] = s[a].wrapping_add(s[b]);
    s[d] = (s[d] ^ s[a]).rotate_left(13);
    s[c] = s[c].wrapping_add(s[d]);
    s[b] = (s[b] ^ s[c]).rotate_left(5);
}

fn keystream_block(key: &[u32; 8], counter: u32, nonce: [u32; 3]) -> [u8; 64] {
    let mut init = [0u32; 16];
    init[..4].copy_from_slice(&SIGMA);
    init[4..12].copy_from_slice(key);
    init[12] = counter;
    init[13..].copy_from_slice(&nonce);
    let mut s = init;
    for _ in 0..4 {
        // column round, then diagonal round (8 rounds in total)
        qr(&mut s, 0, 4, 8, 12);
        qr(&mut s, 1, 5, 9, 13);
        qr(&mut s, 2, 6, 10, 14);
        qr(&mut s, 3, 7, 11, 15);
        qr(&mut s, 0, 5, 10, 15);
        qr(&mut s, 1, 6, 11, 12);
        qr(&mut s, 2, 7, 8, 13);
        qr(&mut s, 3, 4, 9, 14);
    }
    let mut out = [0u8; 64];
    for i in 0..16 {
        out[4 * i..4 * i + 4].copy_from_slice(&s[i].wrapping_add(init[i]).to_le_bytes());
    }
    out
}

// anti-debug: a traced process has a non-zero TracerPid
fn traced() -> bool {
    fs::read_to_string("/proc/self/status")
        .map(|s| s.lines().any(|l| l.starts_with("TracerPid:") && l.split_whitespace().nth(1) != Some("0")))
        .unwrap_or(false)
}

fn main() {
    if black_box(env::args().count()) > 8 {
        println!("{BANNER}");
    }
    let mut data = match fs::read(IN_FILE) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("open input: {e}");
            process::exit(2);
        }
    };
    let n = data.len();
    let mut key = KEY;
    if traced() {
        key[0] ^= 1; // poisoned when debugged
    }
    let nonce = [n as u32, 0xA5A5_A5A5, 0x5A5A_5A5A];
    for (counter, chunk) in data.chunks_mut(64).enumerate() {
        let ks = keystream_block(&key, counter as u32, nonce);
        for (b, k) in chunk.iter_mut().zip(ks.iter()) {
            *b ^= k;
        }
    }
    let mut out = Vec::with_capacity(8 + n);
    out.extend_from_slice(b"RSV1");
    out.extend_from_slice(&(n as u32).to_le_bytes());
    out.extend_from_slice(&data);
    if let Err(e) = fs::write(OUT_FILE, out) {
        eprintln!("open output: {e}");
        process::exit(3);
    }
}
