const form = document.getElementById('waitlist');
const email = document.getElementById('email');
const msg = document.getElementById('formMsg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = email.value.trim();
  if (!value || !email.checkValidity()) {
    msg.textContent = 'Enter a valid email';
    return;
  }

  email.disabled = true;
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: value }),
    });
    if (!res.ok) throw new Error(await res.text());
    email.value = '';
    msg.textContent = "You're on the list.";
  } catch {
    msg.textContent = 'Something went wrong, try again.';
  } finally {
    email.disabled = false;
  }
});

// Keep the GitHub star count current.
fetch('https://api.github.com/repos/danielbusnz-lgtm/Peeky')
  .then((r) => r.ok ? r.json() : null)
  .then((data) => {
    if (data && typeof data.stargazers_count === 'number') {
      document.getElementById('stars').textContent = `★ ${data.stargazers_count}`;
    }
  })
  .catch(() => {});

// Orange cursor that eases toward the real pointer with a slight lag.
const cursor = document.getElementById('cursor');
let mouseX = -100, mouseY = -100;
let cursorX = -100, cursorY = -100;

// Offset from the real pointer: positive X moves right, negative Y moves up.
const OFFSET_X = 16;
const OFFSET_Y = -20;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animate() {
  cursorX += (mouseX - cursorX) * 0.07;
  cursorY += (mouseY - cursorY) * 0.07;
  cursor.style.transform = `translate(${cursorX + OFFSET_X}px, ${cursorY + OFFSET_Y}px)`;
  requestAnimationFrame(animate);
}
animate();
