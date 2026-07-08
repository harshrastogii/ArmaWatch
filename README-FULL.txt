ARMAWATCH — FULL VERSION (map + data dashboard)
===============================================

This is the complete website: the weapons map PLUS a data dashboard that
shows charts and key facts about the companies. It works on phones too.

WHAT PEOPLE CAN DO WITH IT
Everything the simple version does, PLUS:
- A dashboard page with charts (companies by program, by state, and more)
- Plain-English insights, like which state has the most weapons sites
- A moving list of every company, to drive the message home

WHAT'S IN THIS FOLDER
- "dist" folder ......... the finished website, ready to put online
- "app" folder .......... the editable version (for future changes)
- "data" file ........... the list of all 127 companies

HOW TO PUT IT ONLINE
This one is its own separate web page (not inside the existing page).
Whoever looks after the website can:
1. Take the "dist" folder.
2. Put it online as a new page, for example wagepeaceau.org/armawatch
3. Add a link to it from the menu or the weapons map page.

Free services like Netlify or Vercel can also host it in a few clicks.

WANT TO SEE IT ON YOUR OWN COMPUTER FIRST?
If you have a tool called Node.js installed (free, from nodejs.org):
1. Open the "app" folder
2. Type:  npm install
3. Then type:  npm run preview
4. Open the web address it shows you.

HOW TO UPDATE THE COMPANY LIST
Open "app/public/data/weapons.geojson" in any text editor and edit the
entries. No other changes needed.

QUESTIONS?
Built for Wage Peace by Harsh Rastogi — harshrastogii.com
