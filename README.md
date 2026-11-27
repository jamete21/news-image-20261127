[![make.fun · news-image-20261127](https://make.fun/badge/news-image-20261127.svg)](https://make.fun/bounty/news-image-20261127?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261127)
[![rank](https://make.fun/badge/news-image-20261127/jamete21/news-image-20261127/rank.svg)](https://make.fun/bounty/news-image-20261127?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261127)
[![reward](https://make.fun/badge/news-image-20261127/jamete21/news-image-20261127/reward.svg)](https://make.fun/bounty/news-image-20261127?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261127)

# The World in One Picture — Friday 27 November 2026

A newspaper front page drawn entirely in code, summing up the world's news of
Friday 27 November 2026 in a single 1024×1024 image.

## The day's news

- **Lead — EU summit ends in deadlock:** EU leaders left an emergency summit
  in Brussels with no deal on the bloc's next seven-year budget or a new
  €45 billion loan for Ukraine; Friday talks were called off.
- **New Zealand:** final election results leave the ruling coalition with 65
  seats in the 130-seat parliament — one short of a majority.
- **Australia:** counterterrorism financing sanctions on two people over
  antisemitic attacks blamed on Iran's Revolutionary Guard Corps.
- **In brief:** Hernandez de Cos to succeed Lagarde as ECB president; Tokyo
  eyes a ¥56.3 trillion defence plan for 2027–2031; a Yogyakarta court jails
  a daycare foundation head for nine years; markets steady, Brent at $96.14.

Sources: Reuters, Euronews, Asahi — all events first reported 27 November 2026.

## Verification

```sh
mkdir -p out1 out2
MAKEFUN_OUTPUT_DIR=out1 node main.ts
MAKEFUN_OUTPUT_DIR=out2 node main.ts
sha256sum out1/entry.png out2/entry.png   # identical hashes
```

Output: 1024×1024 PNG, well under the 1 MiB limit.

## How it works

`main.ts` (Node, standard library only, no network) draws the page with its
own 5×7 bitmap font and its own PNG encoder, then writes `entry.png` to the
output directory. The output is deterministic: two runs produce byte-identical
files.

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
