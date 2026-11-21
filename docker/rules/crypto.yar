/* Tiny crypto-constant rules for the talk. They show why signature tools both help and mislead:
 *   vault  -> hits AES_sbox (a DECOY table that is never used) and the real hash/PRNG constants
 *   UPX    -> hits UPX_packed, the cue to unpack (upx -d) before anything else
 */
rule AES_sbox_table {
    meta: description = "AES forward S-box (first 16 bytes)"
    strings: $s = { 63 7C 77 7B F2 6B 6F C5 30 01 67 2B FE D7 AB 76 }
    condition: $s
}

rule FNV1a_64_constants {
    meta: description = "FNV-1a 64-bit offset basis / prime (little-endian immediates)"
    strings:
        $off   = { 25 23 22 84 E4 9C F2 CB }
        $prime = { B3 01 00 00 00 01 00 00 }
    condition: any of them
}

rule Xorshift64star_multiplier {
    meta: description = "xorshift64* multiplier 0x2545F4914F6CDD1D"
    strings: $m = { 1D DD 6C 4F 91 F4 45 25 }
    condition: $m
}

rule UPX_packed {
    meta: description = "UPX magic; ELF builds have no UPX0/UPX1 section names, so key on the header magic"
    strings: $magic = "UPX!"
    condition: $magic
}
