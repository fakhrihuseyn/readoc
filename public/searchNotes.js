async function searchNotes() {
  const query = document.getElementById('searchInput').value.trim();
  const list = document.getElementById('notesList');
  list.innerHTML = '';
  let notes = [];
  try {
    let res;
    if (!query) {
      // If query is empty, fetch all notes
      res = await fetch('/api/notes');
      if (!res.ok) throw new Error('Failed to fetch notes');
      notes = await res.json();
    } else {
      // Otherwise, search
      res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      notes = await res.json();
    }
    if (notes.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No matching notes found.';
      list.appendChild(li);
      return;
    }
    notes.forEach(n => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = n.title;
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        await openNote(n.id);
      });
      li.appendChild(a);
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
}