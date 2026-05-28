// Fixed launch target, the same for every visitor. Counting to a hardcoded
// instant (not "now + 30 days" per load) is what makes the countdown real.
const LAUNCH = new Date("2026-06-27T20:28:31Z");

function updateCountdown() {
    // Clamp at zero so the timer stops at 0 0:00:00 instead of going negative.
    const diffInMs = Math.max(0, LAUNCH - new Date());

    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffInMs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diffInMs / (1000 * 60)) % 60);
    const seconds = Math.floor((diffInMs / 1000) % 60);

    const pad = (n) => String(n).padStart(2, "0");
    const time = `${days} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    document.getElementById("countdown").textContent = time;
}

updateCountdown();
setInterval(updateCountdown, 1000);

let mouseX = -100, mouseY = -100;
let cursorX = -100, cursorY = -100;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function animate() {
    cursorX += (mouseX - cursorX) * 0.07;
    cursorY += (mouseY - cursorY) * 0.07;


    cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) rotate(-25deg)`;
    requestAnimationFrame(animate);
}
animate();

// Submit the email on Enter. Posts to the Vercel function, which stores it.
const emailInput = document.querySelector('.input');
const emailLabel = document.querySelector('.label');

emailInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const email = emailInput.value.trim();
  if (!email || !emailInput.checkValidity()) {
    emailLabel.textContent = 'Enter a valid email';
    return;
  }

  emailInput.disabled = true;
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(await res.text());
    emailInput.value = '';
    emailLabel.textContent = "You're on the list";
  } catch {
    emailInput.disabled = false;
    emailLabel.textContent = 'Something went wrong, try again';
  }
});
