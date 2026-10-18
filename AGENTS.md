PROJECT
qrd: user submission based map / notification system for popups around UCI. like waze.
    Posted by organizers + passerbys
    Rating system -> require x reports in y meter radius before notifying
        more thumbs up -> more points for user
    Short, precise tags:
        free food, free merch, discounts, career development 
    Location submission: 
        (long, lat)
        Coords, title, description, tag, expiration? (< add report system similar to waze for whether its still present)
FILES (suggested outline)
frontend/src/
App.jsx - work in here to make your webpages
	components
RandomItem.jsx - can delete
ADD these vvv
EventCard.jsx
EventList.jsx
SignupForm.jsx
PostEventModal.jsx
	services/useRandomItem.js - Replace with useEvents.js
		(a “hook” aka a function that asks backend for data)
	main.jsx, index.html - these plug React into the webpage
index.css, App.css - styling; to yassify your webpage
vite.config.js - don’t touch it
package.json, package-lock.json - don’t touch it
eslint.config.js, .prettierrc, jsconfig.json - code-stylers (no need to worry)
public/vite.svg, assets/react.svg - logos from the template, can delete
backend/src
api.py - The routes! FastAPI stuff
db.py (supabase client), users.py (user routes), events.py (event routes and emailer)
*supabase will need to be added into requirements.txt

ADD: folder called mailer
package.json
index.js (where you’ll be coding the logic)
