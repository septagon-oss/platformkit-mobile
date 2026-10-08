#!/usr/bin/env python3
# The code a time-based factor answers with right now, printed on stdout.
#
# The device harness needs one: enrolling a factor goes through the kernel's own
# door (POST /api/v1/auth/factors/totp/begin then …/totp/finish), and the
# harness proves the second-factor leg over HTTP while the code it computed is
# still inside its step (scripts/e2e/mobile_ci.sh). The product never computes a
# code — a phone asks a person for one — which is why this file sits beside the
# harness and not under src/.
#
# RFC 6238 over the standard library alone, agreeing with the kernel's own
# parameters (modules/auth: 6 digits, a 30-second step, SHA-1, a base32 secret,
# and one step of skew either side). This prints the centre of that window: the
# code that is right at this instant, which is the one worth enrolling with and
# the only one worth proving with.
#
#   python3 scripts/e2e/totp.py <base32-secret>        # the code for this instant
#   python3 scripts/e2e/totp.py --at 1760000000 <secret>   # for a named instant, in test
import argparse
import base64
import hashlib
import hmac
import struct
import sys
import time

DIGITS = 6
PERIOD = 30


def code(secret: str, at: float) -> str:
    key = base64.b32decode(secret.strip().upper(), casefold=True)
    counter = int(at // PERIOD)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10**DIGITS).zfill(DIGITS)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="print the current TOTP for a secret")
    parser.add_argument("secret", help="the base32 secret auth-factors-totp-begin answered")
    parser.add_argument(
        "--at", type=float, help="unix seconds to answer for; the machine's clock by default"
    )
    args = parser.parse_args(argv)
    sys.stdout.write(code(args.secret, args.at if args.at is not None else time.time()) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
