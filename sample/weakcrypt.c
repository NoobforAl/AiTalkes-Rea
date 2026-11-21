/* weakcrypt.c - demo target: "encrypts" a fixed file with a weak cipher.
 * Usage: weakcrypt   (no arguments: reads ./secret.txt, writes ./secret.enc)
 * Cipher: repeating-key XOR + a fixed +7 byte shift. Key is hard-coded.
 */
#include <stdio.h>
#include <string.h>

#define IN_FILE  "secret.txt"
#define OUT_FILE "secret.enc"

static const char KEY[] = "S3cr3t!";

static void weak_encrypt(unsigned char *buf, size_t len) {
    size_t klen = strlen(KEY);
    for (size_t i = 0; i < len; i++) {
        buf[i] = (unsigned char)((buf[i] ^ KEY[i % klen]) + 7);
    }
}

int main(void) {
    FILE *in = fopen(IN_FILE, "rb");
    if (!in) { perror("open " IN_FILE); return 1; }

    unsigned char buf[4096];
    size_t n = fread(buf, 1, sizeof buf, in);
    fclose(in);

    weak_encrypt(buf, n);

    FILE *out = fopen(OUT_FILE, "wb");
    if (!out) { perror("open " OUT_FILE); return 2; }
    fwrite(buf, 1, n, out);
    fclose(out);
    printf("encrypted %zu bytes\n", n);
    return 0;
}
