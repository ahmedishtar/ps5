https://soniciso1.github.io/pooP2JB/

# p2jb / poopsploit — PS5 WebKit exploit host

Static site. Open `index.html` on the console browser; it detects the firmware and
greys out whichever exploit cannot run.

| exploit    | firmware      | technique                              |
|------------|---------------|----------------------------------------|
| Poopsploit | 9.00 – 12.00  | IPv6 `rthdr` UAF                       |
| P2JB       | 12.00 – 12.70 | `cr_ref` overflow via `kqueueex` (~1 h) |

12.00 is the one firmware both cover.

## Hosting

Serve the directory. No build step. Works at a domain root **or in a subdirectory**
(which is what GitHub Pages gives you at `USER.github.io/REPO/`).

`.nojekyll` is required and present — without it Pages runs Jekyll, which silently
drops files and directories whose names begin with `_`.

## Payload delivery on GitHub Pages

After the jailbreak, the exploit page has native syscall access and can open a real TCP
socket to the console's `elfldr` on `127.0.0.1:9021`. The payload menu therefore works
from a static host such as GitHub Pages without PHP or Node.

P2JB and Poopsploit automatically send `payloads/pldmgr.elf` after starting `elfldr`.
The sender waits 1.5 seconds without touching the fd table and then makes one connection
attempt. A failure falls back to the payload menu instead of opening and closing sockets
in a retry loop inside the post-UAF process.
Use `?noautoload=1` to keep the jailbreak and payload menu but disable that automatic
send for troubleshooting.

If direct delivery fails, the menu reports the reason and you can still send an ELF
from another machine:

```
nc <ps5-ip> 9021 < payloads/etaHEN.elf
```

A tile that cannot deliver outlines red and prints the reason plus the `nc` command,
rather than silently doing nothing. A successful tile outlines green.

Ready-made fallback handlers remain in `api/` (`payload.php` + `.htaccess`, and
`serve.js`) for hosts that can run PHP or Node. On Pages they are inert and normally
unnecessary because the direct sender is preferred.

The other endpoints degrade safely: the one-shot latch falls back to `localStorage`
(which survives a reboot and a WebProcess crash, exactly when the guard matters),
progress beacons 404 inside `try/catch`, and the `api/elfldr` probe is content-type
guarded. `?clear=1` clears the latch.

## Warnings

- P2JB spends about an hour on the leak with no output. That is normal — do not interrupt.
- After a jailbreak, ending the WebProcess can panic the kernel. If a run aborts after
  stage 1 the page tells you to power-cycle rather than reload; follow that, because a
  socket still aliases a live kernel object and closing it is what panics.
- Repeated panics degrade the console filesystem. If fsck reports `major>0` at boot, do a
  full power drain and consider Safe Mode → Rebuild Database.

## Credits

See the creds & greetz block on `index.html`. Based on the webkit by j0rdy.
