MBUX SOUND DRIVE - GPS FIX

IMPORTANT
The HTML now detects the Android content:// / file:// case before requesting GPS.
Modern browsers require Geolocation to run in a secure web context (normally HTTPS),
and the browser also needs its own Location permission. Turning on the phone's GPS/Location
switch does not grant a webpage permission.

HOW TO MAKE GPS WORK
1. Upload mbux_sound_drive_mobile.html to an HTTPS host such as GitHub Pages, Netlify,
   Vercel, or another HTTPS web server.
2. Open the HTTPS address in Chrome on the Android phone.
3. Allow Chrome's Location permission when prompted.
4. Tap USE GPS in Sound Drive.
5. If Android previously denied Chrome Location: Settings > Apps > Chrome > Permissions >
   Location > Allow, then return to the HTTPS page and tap USE GPS again.

WHAT THE CODE NOW DOES
- Checks secure context before requesting location.
- Checks browser geolocation permission with the Permissions API when available.
- Uses a fresh high-accuracy position first.
- Falls back to a lower-accuracy provider if high-accuracy acquisition times out/unavailable.
- Starts watchPosition only after an initial fix.
- Shows a useful error instead of the generic "permission denied" message.

DIRECT content:// FILES
A single self-contained HTML file fixes local CSS/JS/image loading, but it cannot override
browser security restrictions on Geolocation. No JavaScript inside the HTML can grant itself
GPS permission or turn a non-secure origin into HTTPS.
