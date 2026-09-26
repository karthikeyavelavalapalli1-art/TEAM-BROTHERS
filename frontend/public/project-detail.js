document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');

  if (!projectId) {
    alert('Project ID not found.');
    window.location.href = 'project.html';
    return;
  }

  try {
    const res = await fetch(`/api/past-works/${projectId}`);
    if (!res.ok) {
      throw new Error('Project not found');
    }
    
    const project = await res.json();
    
    // Inject data
    document.title = `${project.title} | TEAM BROTHERS`;
    document.getElementById('p-category').textContent = project.category || 'PROJECT';
    document.getElementById('p-title').textContent = project.title || 'Untitled';
    document.getElementById('p-description').textContent = project.description || '';
    document.getElementById('p-image').src = project.image || '';

    // Handle external link
    if (project.link) {
      document.getElementById('p-action-container').style.display = 'block';
      document.getElementById('p-link').href = project.link;
    }

    // Reveal UI
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    
    // Simple fade in animation for elements
    document.querySelectorAll('.fade-in-up').forEach(el => {
      el.style.opacity = 0;
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
      
      // small delay to let display: block take effect
      setTimeout(() => {
        el.style.opacity = 1;
        el.style.transform = 'translateY(0)';
      }, 50);
    });

  } catch (err) {
    console.error('Failed to load project details:', err);
    alert('Could not load project details. It may have been deleted.');
    window.location.href = 'project.html';
  }
});
