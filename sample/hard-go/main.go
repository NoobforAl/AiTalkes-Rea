// vault-go - HARD demo target #2 for the reverse-engineering talk (Go; educational, benign).
// Usage: vault-go   (no arguments: reads ./secret.txt, writes ./secret.enc)
//
// Why it is hard (and different from the C sample):
//   - Go runtime inside a static binary    -> thousands of runtime.* / crypto functions around ~15 of ours
//   - stripped (-s -w) and -trimpath       -> no symbols, no DWARF, no source paths (names survive only in pclntab)
//   - strings are (pointer, length) pairs  -> no NUL terminators, so `strings` shows one huge merged blob
//   - work happens in goroutines           -> channels and closures instead of a straight-line main
//   - indirect calls through an interface  -> the round function is picked via an itab, not a direct call
//   - key is never a plain string          -> masked seed, SHA-256 applied 1000 times, then a xorshift64* key schedule
//   - decoys                               -> a fake "AES-256-GCM key" banner; SHA-256 constants that are only a KDF
//   - anti-debug                           -> if TracerPid != 0 the seed is silently poisoned
//
// Cipher: 64-bit blocks, 6-round Feistel, per-block whitening by block index (order independent, so it can run in parallel).
// Output format: "GOV1" | u32 little-endian length | ciphertext (length rounded up to 8)
package main

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math/bits"
	"os"
	"strings"
	"sync"
)

// file names are fixed on purpose: no command line, so no wrong file name
const (
	inFile  = "secret.txt"
	outFile = "secret.enc"
	rounds  = 6
)

// decoy: looks like a key, is never used
var banner = "ledger v3 | cipher=AES-256-GCM | key=" + strings.Repeat("6b65792d", 4)

// real key material, masked: seed[i] = maskedSeed[i] ^ byte(0x5a + 7*i)
var maskedSeed = [...]byte{0x37, 0x0e, 0x04, 0x0a, 0x5b, 0x14, 0xea, 0xa6, 0xe6, 0xf1, 0xc5, 0x8a, 0xda, 0xc0, 0xd2, 0xad, 0xaf, 0xbd}

type mixer interface{ mix(x, k uint32) uint32 }

type mulMix struct{}
type addMix struct{}

func (mulMix) mix(x, k uint32) uint32 { return bits.RotateLeft32(x*0x9E3779B1^k, 5) + x>>3 }
func (addMix) mix(x, k uint32) uint32 { return bits.RotateLeft32((x+k)*0x85EBCA6B, 13) ^ x<<7 }

func whiten(i uint64) uint64 { return bits.RotateLeft64(i*0x9E3779B97F4A7C15, 17) }

type cipher struct {
	rk [rounds]uint32
	f  [2]mixer
}

// anti-debug: a traced process has a non-zero TracerPid
func tracerAttached() bool {
	st, err := os.ReadFile("/proc/self/status")
	if err != nil {
		return false
	}
	for _, ln := range strings.Split(string(st), "\n") {
		if strings.HasPrefix(ln, "TracerPid:") {
			return strings.TrimSpace(strings.TrimPrefix(ln, "TracerPid:")) != "0"
		}
	}
	return false
}

func newCipher() *cipher {
	seed := make([]byte, len(maskedSeed))
	for i, b := range maskedSeed {
		seed[i] = b ^ byte(0x5a+7*i)
	}
	if tracerAttached() {
		seed[0] ^= 1 // poisoned when debugged
	}
	h := sha256.Sum256(seed)
	for i := 0; i < 999; i++ {
		h = sha256.Sum256(h[:])
	}
	s := binary.LittleEndian.Uint64(h[:8]) | 1
	c := &cipher{f: [2]mixer{mulMix{}, addMix{}}}
	for i := range c.rk { // xorshift64* key schedule, high 32 bits
		s ^= s >> 12
		s ^= s << 25
		s ^= s >> 27
		c.rk[i] = uint32((s * 0x2545F4914F6CDD1D) >> 32)
	}
	return c
}

func (c *cipher) block(b, idx uint64) uint64 {
	x := b ^ whiten(idx)
	l, r := uint32(x>>32), uint32(x)
	for i := 0; i < rounds; i++ {
		l, r = r, l^c.f[i&1].mix(r, c.rk[i])
	}
	return uint64(r)<<32 | uint64(l)
}

func main() {
	data, err := os.ReadFile(inFile)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open input:", err)
		os.Exit(2)
	}
	n := len(data)
	padded := make([]byte, (n+7)&^7)
	copy(padded, data)

	type job struct {
		idx int
		blk uint64
	}
	c := newCipher()
	jobs, done := make(chan job), make(chan job)
	var wg sync.WaitGroup
	for w := 0; w < 4; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobs {
				done <- job{j.idx, c.block(j.blk, uint64(j.idx))}
			}
		}()
	}
	go func() {
		for i := 0; i < len(padded); i += 8 {
			jobs <- job{i / 8, binary.LittleEndian.Uint64(padded[i:])}
		}
		close(jobs)
	}()
	go func() { wg.Wait(); close(done) }()

	out := make([]byte, 8+len(padded))
	copy(out, "GOV1")
	binary.LittleEndian.PutUint32(out[4:], uint32(n))
	for j := range done {
		binary.LittleEndian.PutUint64(out[8+j.idx*8:], j.blk)
	}
	if err := os.WriteFile(outFile, out, 0o644); err != nil {
		fmt.Fprintln(os.Stderr, "open output:", err)
		os.Exit(3)
	}
}
