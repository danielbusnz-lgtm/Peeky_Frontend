const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 30);

function updateCountdown() {
    const now = new Date();
    const diffInMs = futureDate - now;

    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffInMs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diffInMs / (1000 * 60)) % 60);
    const seconds = Math.floor((diffInMs / 1000) % 60);

    const time = `${days} ${hours}:${minutes}:${seconds}`;
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

document.querySelector('a[href="#more"]').addEventListener('click', (e) => {
  e.preventDefault();
  e.currentTarget.style.display = 'none';   // hide the link itself
  const more = document.getElementById('more');
  more.style.display = 'block';
  more.scrollIntoView({ behavior: 'smooth' });
});
