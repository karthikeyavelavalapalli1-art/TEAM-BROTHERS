// Mobile menu toggle
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const appSidebar = document.getElementById('app-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

if (mobileMenuToggle && appSidebar && sidebarOverlay) {
  const toggleMenu = () => {
    appSidebar.classList.toggle('show');
    sidebarOverlay.classList.toggle('show');
  };
  
  mobileMenuToggle.addEventListener('click', toggleMenu);
  sidebarOverlay.addEventListener('click', toggleMenu);
  
  // Close menu on nav item click (for mobile)
  const navItems = appSidebar.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 900) {
        appSidebar.classList.remove('show');
        sidebarOverlay.classList.remove('show');
      }
    });
  });
}

document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('title').value;
  const category = document.getElementById('category').value;
  let image = document.getElementById('image').value;
  const description = document.getElementById('description').value;
  const prize_pool = document.getElementById('prize_pool').value;
  const statusMsg = document.getElementById('status-message');
  const submitBtn = document.querySelector('.submit-btn');

  // Reset status
  statusMsg.style.display = 'block';
  statusMsg.className = 'message';
  statusMsg.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';

  // Check if a file was selected but not uploaded
  const fileInput = document.getElementById('file-upload');
  if (fileInput && fileInput.files.length > 0 && !image.startsWith('uploads/')) {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    try {
      const res = await fetch('/api/upload-media', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload image');
      image = data.url;
      document.getElementById('image').value = image;
    } catch (err) {
      statusMsg.className = 'message error';
      statusMsg.textContent = 'Upload failed: ' + err.message;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Project';
      return;
    }
  }

  // Validate the final image value
  if (!image.startsWith('http://') && !image.startsWith('https://') && !image.startsWith('uploads/')) {
    statusMsg.className = 'message error';
    statusMsg.textContent = 'Invalid image path. Please use the "Upload" button to select a file from your computer, or enter a valid web URL (https://...).';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Project';
    return;
  }

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, category, image, description, prize_pool })
    });

    const data = await response.json();

    if (response.ok) {
      statusMsg.className = 'message success';
      statusMsg.textContent = 'Project successfully created!';
      document.getElementById('upload-form').reset();
      fetchAndRenderWorks(); // Refresh the list
      
      // Close modal after success
      setTimeout(() => {
        document.getElementById('new-project-modal').style.display = 'none';
        statusMsg.style.display = 'none';
      }, 1500);
    } else {
      throw new Error(data.error || 'Failed to create project');
    }
  } catch (error) {
    statusMsg.className = 'message error';
    statusMsg.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload Tournament';
  }
});

// Manage Records Logic
document.addEventListener('DOMContentLoaded', () => {
  const cursorLayer = document.querySelector('.cursor-layer');
  const cursorDot = document.querySelector('.cursor-dot');
  const cursorTrails = [...document.querySelectorAll('.cursor-trail')];

  if (cursorLayer && cursorDot && cursorTrails.length) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    const trailState = cursorTrails.map((trail, index) => ({
      x: mouseX,
      y: mouseY,
      trail,
      delay: index + 1
    }));

    const moveCursor = (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      cursorLayer.classList.add('visible');
    };

    document.addEventListener('pointermove', moveCursor);
    document.addEventListener('pointerleave', () => cursorLayer.classList.remove('visible'));

    const animateCursor = () => {
      cursorDot.style.left = `${mouseX}px`;
      cursorDot.style.top = `${mouseY}px`;

      trailState.forEach((item, index) => {
        const factor = (index + 1) / trailState.length;
        item.x += (mouseX - item.x) * (0.18 + index * 0.04);
        item.y += (mouseY - item.y) * (0.18 + index * 0.04);
        item.trail.style.left = `${item.x}px`;
        item.trail.style.top = `${item.y}px`;
        item.trail.style.opacity = String(0.9 - factor * 0.75);
        item.trail.style.transform = `translate(-50%, -50%) scale(${1 - factor * 0.3})`;
      });

      requestAnimationFrame(animateCursor);
    };

    requestAnimationFrame(animateCursor);
  }

  fetchAndRenderWorks();
  
  // Open New Project Modal
  const btnShowNewProject = document.getElementById('btn-show-new-project');
  if (btnShowNewProject) {
    btnShowNewProject.addEventListener('click', () => {
      document.getElementById('new-project-modal').style.display = 'block';
      document.getElementById('upload-form').reset();
      document.getElementById('status-message').style.display = 'none';
    });
  }

  // Cancel New Project
  const btnCancelNewProject = document.getElementById('btn-cancel-new-project');
  if (btnCancelNewProject) {
    btnCancelNewProject.addEventListener('click', () => {
      document.getElementById('new-project-modal').style.display = 'none';
    });
  }

  // Handle file upload in New Project modal
  const btnUpload = document.getElementById('btn-upload');
  const fileUpload = document.getElementById('file-upload');
  if (btnUpload && fileUpload) {
    btnUpload.addEventListener('click', () => {
      fileUpload.click();
    });
    fileUpload.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        document.getElementById('image').value = e.target.files[0].name + ' (Pending upload...)';
      }
    });
  }

  const setupToggle = (showBtnId, cancelBtnId, containerId, formId) => {
    const showBtn = document.getElementById(showBtnId);
    const cancelBtn = document.getElementById(cancelBtnId);
    const container = document.getElementById(containerId);
    const form = document.getElementById(formId);
    
    if (showBtn && container) {
      showBtn.addEventListener('click', () => {
        container.style.display = 'block';
        if (form) form.reset();
      });
    }
    if (cancelBtn && container) {
      cancelBtn.addEventListener('click', () => {
        container.style.display = 'none';
      });
    }
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('This feature is coming soon!');
      });
    }
  };

  setupToggle('btn-show-new-category', 'btn-cancel-new-category', 'new-category-form-container', null);
  
  const categoryForm = document.getElementById('new-category-form');
  if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-category-name').value;
      const submitBtn = categoryForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
      try {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        if (res.ok) {
          document.getElementById('new-category-form-container').style.display = 'none';
          categoryForm.reset();
          fetchAndRenderCategories();
        } else {
          alert('Failed to save category');
        }
      } catch (err) {
        alert(err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save';
      }
    });
  }

    // Edit category handlers
    document.getElementById('btn-cancel-edit-category')?.addEventListener('click', () => {
      document.getElementById('edit-category-form-container').style.display = 'none';
      document.getElementById('edit-category-form').reset();
    });

    const editCategoryForm = document.getElementById('edit-category-form');
    if (editCategoryForm) {
      editCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-category-id').value;
        const newName = document.getElementById('edit-category-name').value;
        const submitBtn = editCategoryForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';
        try {
          const res = await fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
          });
          if (res.ok) {
            document.getElementById('edit-category-form-container').style.display = 'none';
            editCategoryForm.reset();
            fetchAndRenderCategories();
            if (typeof fetchAndRenderWorks === 'function') fetchAndRenderWorks();
          } else {
            alert('Failed to update category');
          }
        } catch (err) {
          alert(err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Update';
        }
      });
    }
  });

async function fetchAndRenderWorks() {
  const container = document.getElementById('records-container');
  try {
    const response = await fetch('/api/past-works');
    if (!response.ok) throw new Error('Failed to fetch records');
    const records = await response.json();
    
    container.innerHTML = '';
    
    if (records.length === 0) {
      container.innerHTML = '<p class="empty-msg">No tournaments found.</p>';
      return;
    }
    
    // Populate category datalist
    const uniqueCategories = [...new Set(records.map(r => r.category))];
    const datalists = document.querySelectorAll('#category-options');
    datalists.forEach(datalist => {
      datalist.innerHTML = '';
      uniqueCategories.forEach(cat => {
        if (cat) {
          const option = document.createElement('option');
          option.value = cat;
          datalist.appendChild(option);
        }
      });
    });

    records.forEach(record => {
      const item = document.createElement('div');
      item.className = 'record-item';

      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'record-content';

      const media = document.createElement('div');
      media.className = 'record-media';

      // Image thumbnail
      if (record.image) {
        const img = document.createElement('img');
        img.src = '/' + record.image; // Assuming image path starts with 'uploads/'
        if (record.image.startsWith('http')) img.src = record.image;
        img.className = 'record-thumb';
        media.appendChild(img);
      }

      const info = document.createElement('div');
      info.className = 'record-info';

      const title = document.createElement('div');
      title.className = 'record-title';
      title.textContent = record.title;

      const category = document.createElement('div');
      category.className = 'record-category';
      category.textContent = record.category;

      info.appendChild(title);
      info.appendChild(category);

      const actionsWrapper = document.createElement('div');
      actionsWrapper.className = 'record-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn-delete btn-edit';
      editBtn.style.borderColor = '#3b82f6';
      editBtn.style.color = '#3b82f6';
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('data-id', record.id);
      editBtn.setAttribute('data-record', JSON.stringify(record));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('data-id', record.id);

      actionsWrapper.appendChild(editBtn);
      actionsWrapper.appendChild(deleteBtn);

      contentWrapper.appendChild(media);
      contentWrapper.appendChild(info);
      item.appendChild(contentWrapper);
      item.appendChild(actionsWrapper);

      container.appendChild(item);
    });
    
    // Add delete event listeners
    document.querySelectorAll('.btn-delete:not(.btn-edit)').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this tournament?')) {
          await deleteRecord(id);
        }
      });
    });

    // Add edit event listeners
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const record = JSON.parse(e.target.getAttribute('data-record'));
        openEditProjectModal(record);
      });
    });
  } catch (error) {
    container.innerHTML = '<p class="error-msg">Error loading records.</p>';
    console.error(error);
  }
}

// Edit Project Logic
function openEditProjectModal(record) {
  const modal = document.getElementById('edit-project-modal');
  document.getElementById('edit-project-id').value = record.id;
  document.getElementById('edit-project-title').value = record.title || '';
  document.getElementById('edit-project-category').value = record.category || '';
  document.getElementById('edit-project-image').value = record.image || '';
  document.getElementById('edit-project-description').value = record.description || '';
  document.getElementById('edit-project-prize-pool').value = record.prize_pool || '';
  
  const errorMsg = document.getElementById('edit-project-error-msg');
  errorMsg.style.display = 'none';
  
  modal.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  // Cancel edit
  const btnCancel = document.getElementById('btn-cancel-project-edit');
  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      document.getElementById('edit-project-modal').style.display = 'none';
    });
  }

  // Handle edit form submit
  const editForm = document.getElementById('edit-project-form');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('edit-project-id').value;
      const title = document.getElementById('edit-project-title').value;
      const category = document.getElementById('edit-project-category').value;
      let image = document.getElementById('edit-project-image').value;
      const description = document.getElementById('edit-project-description').value;
      const prize_pool = document.getElementById('edit-project-prize-pool').value;
      
      const errorMsg = document.getElementById('edit-project-error-msg');
      const submitBtn = document.getElementById('btn-save-project-edit');
      
      errorMsg.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
      
      // Auto-upload if file is selected
      const fileInput = document.getElementById('edit-file-upload');
      if (fileInput && fileInput.files.length > 0 && !image.startsWith('uploads/')) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        try {
          const res = await fetch('/api/upload-media', { method: 'POST', body: formData });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to upload image');
          image = data.url;
          document.getElementById('edit-project-image').value = image;
        } catch (err) {
          errorMsg.style.display = 'block';
          errorMsg.textContent = 'Upload failed: ' + err.message;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Changes';
          return;
        }
      }

      // Validate the final image value
      if (!image.startsWith('http://') && !image.startsWith('https://') && !image.startsWith('uploads/')) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Invalid image path. Please use the "Upload" button to select a file from your computer, or enter a valid web URL (https://...).';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
        return;
      }

      try {
        const response = await fetch('/api/past-works/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, category, image, description, prize_pool })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          document.getElementById('edit-project-modal').style.display = 'none';
          fetchAndRenderWorks(); // Refresh list
        } else {
          throw new Error(data.error || 'Failed to update project');
        }
      } catch (err) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = err.message;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    });
  }

  setupImageUpload('edit-file-upload', 'btn-edit-upload', 'edit-project-image');
});

async function deleteRecord(id) {
  try {
    const response = await fetch(`/api/past-works/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      fetchAndRenderWorks();
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to delete tournament');
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('Error deleting tournament');
  }
}

// Check Role and Show Master UI
async function checkRole() {
  try {
    const response = await fetch('/api/me');
    if (response.ok) {
      const data = await response.json();
      if (data.user && data.user.role === 'master') {
        const masterNav = document.getElementById('nav-master-controls');
        if (masterNav) masterNav.style.display = 'flex';
        fetchAndRenderAdmins();
      }
    }
  } catch (err) {
    console.error('Error fetching user role:', err);
  }
}

async function fetchAndRenderAdmins() {
  const container = document.getElementById('sub-admins-list');
  if (!container) return;
  
  try {
    const response = await fetch('/api/admins');
    if (!response.ok) throw new Error('Failed to fetch admins');
    const admins = await response.json();
    
    container.innerHTML = '';
    
    if (admins.length === 0) {
      container.innerHTML = '<p style="color: var(--color-mute);">No sub-admins exist.</p>';
      return;
    }
    
    admins.forEach(admin => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '8px';
      item.style.background = 'rgba(255,255,255,0.05)';
      item.style.borderRadius = '4px';
      item.style.marginBottom = '8px';
      
      const infoDiv = document.createElement('div');
      infoDiv.style.display = 'flex';
      infoDiv.style.flexDirection = 'column';
      
      const name = document.createElement('span');
      name.textContent = `ID: ${admin.username}`;
      name.style.fontWeight = 'bold';
      
      const pass = document.createElement('span');
      pass.textContent = `Pass: (Hidden by Security)`;
      pass.style.fontSize = '0.85rem';
      pass.style.color = 'var(--color-mute)';
      
      infoDiv.appendChild(name);
      infoDiv.appendChild(pass);
      
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '8px';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn-delete';
      editBtn.style.padding = '4px 8px';
      editBtn.style.fontSize = '0.8rem';
      editBtn.style.borderColor = '#3b82f6';
      editBtn.style.color = '#3b82f6';
      editBtn.textContent = 'Edit';

      editBtn.addEventListener('click', () => {
        const modal = document.getElementById('edit-modal');
        const usernameInput = document.getElementById('edit-admin-username');
        const passwordInput = document.getElementById('edit-admin-password');
        const errorMsg = document.getElementById('edit-error-msg');
        
        usernameInput.value = admin.username;
        passwordInput.value = '';
        errorMsg.style.display = 'none';
        
        modal.style.display = 'flex';
        
        // Define save handler
        const handleSave = async () => {
          const newUsername = usernameInput.value.trim();
          const newPassword = passwordInput.value.trim();
          
          if (!newUsername || !newPassword) {
            errorMsg.style.display = 'block';
            errorMsg.textContent = 'Username and password are required.';
            return;
          }

          try {
            const res = await fetch(`/api/admins/${admin.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: newUsername, password: newPassword })
            });
            
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || 'Failed to update admin');
            }
            
            modal.style.display = 'none';
            cleanup();
            fetchAndRenderAdmins();
          } catch (err) {
            errorMsg.style.display = 'block';
            errorMsg.textContent = err.message;
          }
        };

        const handleCancel = () => {
          modal.style.display = 'none';
          cleanup();
        };
        
        const cleanup = () => {
          document.getElementById('btn-save-edit').removeEventListener('click', handleSave);
          document.getElementById('btn-cancel-edit').removeEventListener('click', handleCancel);
        };
        
        document.getElementById('btn-save-edit').addEventListener('click', handleSave);
        document.getElementById('btn-cancel-edit').addEventListener('click', handleCancel);
      });
      
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete';
      delBtn.style.padding = '4px 8px';
      delBtn.style.fontSize = '0.8rem';
      delBtn.textContent = 'Delete';
      
      delBtn.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete admin "${admin.username}"?`)) {
          try {
            await fetch(`/api/admins/${admin.id}`, { method: 'DELETE' });
            fetchAndRenderAdmins();
          } catch (err) {
            console.error(err);
            alert('Failed to delete admin');
          }
        }
      });
      
      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(delBtn);
      
      item.appendChild(infoDiv);
      item.appendChild(actionsDiv);
      container.appendChild(item);
    });
  } catch (error) {
    container.innerHTML = '<p style="color: var(--color-flare);">Error loading admins.</p>';
  }
}

document.addEventListener('DOMContentLoaded', checkRole);

// Create Admin Form Logic
const createAdminForm = document.getElementById('create-admin-form');
if (createAdminForm) {
  createAdminForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('new-admin-username').value;
    const password = document.getElementById('new-admin-password').value;
    const successMsg = document.getElementById('admin-success-msg');
    const errorMsg = document.getElementById('admin-error-msg');
    const btn = document.getElementById('btn-create-admin');
    
    successMsg.style.display = 'none';
    errorMsg.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Creating...';
    
    try {
      const response = await fetch('/api/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        successMsg.style.display = 'block';
        successMsg.textContent = data.message;
        createAdminForm.reset();
        fetchAndRenderAdmins();
      } else {
        errorMsg.style.display = 'block';
        errorMsg.textContent = data.error || 'Failed to create admin';
      }
    } catch (err) {
      errorMsg.style.display = 'block';
      errorMsg.textContent = 'Network error occurred.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Admin';
    }
  });
}

// Logout Logic
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/login.html';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  });
}

// Custom Select Logic
const setupCustomSelect = () => {
  const customSelect = document.getElementById('custom-category-select');
  const trigger = document.getElementById('custom-category-trigger');
  const optionsList = document.getElementById('custom-options-list');
  const hiddenInput = document.getElementById('category');
  const textSpan = document.getElementById('custom-category-text');

  if (customSelect) {
    trigger.addEventListener('click', () => {
      customSelect.classList.toggle('open');
    });

    optionsList.addEventListener('click', (e) => {
      const option = e.target.closest('.custom-option');
      if (option) {
        const value = option.getAttribute('data-value');
        hiddenInput.value = value;
        textSpan.textContent = value;
        customSelect.classList.remove('open');
      }
    });
    document.addEventListener('click', (e) => {
      if (!customSelect.contains(e.target)) {
        customSelect.classList.remove('open');
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', setupCustomSelect);

// SPA Navigation Logic
document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-target]');
  const sections = document.querySelectorAll('.admin-section');

  function navigateTo(targetId) {
    let found = false;
    navItems.forEach(nav => {
      if (nav.getAttribute('data-target') === targetId) {
        nav.classList.add('active');
        found = true;
      } else {
        nav.classList.remove('active');
      }
    });

    if (!found) return;

    sections.forEach(section => {
      if (section.id === targetId) {
        section.style.display = 'block';
      } else {
        section.style.display = 'none';
      }
    });

    if (targetId === 'media' && typeof fetchAndRenderMedia === 'function') {
      fetchAndRenderMedia();
    }
    
    if (targetId === 'overview') {
      fetchAndRenderOverview();
    }
    
    if (targetId === 'statistics') {
      fetchAndRenderStatistics();
    }
    
    if (targetId === 'ongoing-events') {
      if (typeof fetchAndRenderEvents === 'function') {
        fetchAndRenderEvents();
      }
    }
    
    if (targetId === 'categories') {
      fetchAndRenderCategories();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('data-target');
      window.location.hash = targetId;
      navigateTo(targetId);
    });
  });

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1);
    if (hash) {
      navigateTo(hash);
    }
  });

  const initialHash = window.location.hash.substring(1);
  if (initialHash) {
    navigateTo(initialHash);
  }
});

async function fetchAndRenderOverview() {
  try {
    const res = await fetch('/api/dashboard-stats');
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    const data = await res.json();
    
    // Update stats
    if (document.getElementById('stat-projects')) document.getElementById('stat-projects').textContent = data.stats.projects;
    if (document.getElementById('stat-published')) document.getElementById('stat-published').textContent = data.stats.published;
    if (document.getElementById('stat-events')) document.getElementById('stat-events').textContent = data.stats.events;
    if (document.getElementById('stat-categories')) document.getElementById('stat-categories').textContent = data.stats.categories;
  } catch (err) {
    console.error(err);
  }
}


// Media Library Logic — lists real files from /api/media with working previews
async function fetchAndRenderMedia() {
  const grid = document.getElementById('media-grid');
  const status = document.getElementById('media-status');
  if (!grid) return;

  if (status) status.textContent = 'Loading media...';
  grid.innerHTML = '';

  try {
    const res = await fetch('/api/media');
    if (!res.ok) throw new Error('Failed to load media');
    const files = await res.json();

    if (!files || files.length === 0) {
      if (status) status.textContent = 'No media uploaded yet. Use the Projects form to upload an image.';
      grid.innerHTML = '<p style="color: var(--color-mute);">No media found.</p>';
      return;
    }

    if (status) status.textContent = files.length + ' file(s)';

    files.forEach((file) => {
      const card = document.createElement('div');
      card.style.cssText = 'background: rgba(0,0,0,0.5); border: 1px solid var(--color-line); border-radius: 8px; overflow: hidden; padding: 12px;';

      const previewWrap = document.createElement('div');
      previewWrap.style.cssText = 'height: 120px; background: rgba(255,255,255,0.05); margin-bottom: 12px; border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden;';

      if (file.isVideo) {
        const video = document.createElement('video');
        video.src = file.url;
        video.controls = true;
        video.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        previewWrap.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = file.url;
        img.alt = file.name;
        img.loading = 'lazy';
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
        img.onerror = () => {
          previewWrap.innerHTML = '<span style="opacity: 0.5; font-size: 0.8rem;">Preview unavailable</span>';
        };
        previewWrap.appendChild(img);
      }

      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; gap: 8px;';

      const name = document.createElement('span');
      name.textContent = file.name;
      name.title = file.name;
      name.style.cssText = 'color: var(--color-mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;';

      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 6px; align-items: center;';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-delete';
      copyBtn.style.cssText = 'margin:0; padding: 2px 6px;';
      copyBtn.title = 'Copy URL';
      copyBtn.innerHTML = '<i data-lucide="link" style="width: 14px; height: 14px;"></i>';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(file.url.replace(/^\//, ''));
          copyBtn.title = 'Copied!';
        } catch (e) {
          prompt('Copy this URL:', file.url.replace(/^\//, ''));
        }
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete';
      delBtn.style.cssText = 'margin:0; padding: 2px 6px;';
      delBtn.title = 'Delete file';
      delBtn.innerHTML = '<i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>';
      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete "' + file.name + '"?')) return;
        try {
          const delRes = await fetch('/api/media/' + encodeURIComponent(file.name), { method: 'DELETE' });
          if (!delRes.ok) {
            const errData = await delRes.json().catch(() => ({}));
            throw new Error(errData.error || 'Delete failed');
          }
          fetchAndRenderMedia();
          if (typeof fetchAndRenderWorks === 'function') fetchAndRenderWorks();
        } catch (err) {
          alert(err.message);
        }
      });

      actions.appendChild(copyBtn);
      actions.appendChild(delBtn);
      row.appendChild(name);
      row.appendChild(actions);

      card.appendChild(previewWrap);
      card.appendChild(row);
      grid.appendChild(card);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    console.error(err);
    if (status) status.textContent = 'Failed to load media.';
    grid.innerHTML = '<p style="color: var(--color-flare);">Error loading media.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchAndRenderMedia();
  const refreshBtn = document.getElementById('btn-refresh-media');
  if (refreshBtn) refreshBtn.addEventListener('click', fetchAndRenderMedia);
});

// Site Content Editor Logic
document.addEventListener('DOMContentLoaded', () => {
  const jsonEditor = document.getElementById('json-editor');
  const btnSaveContent = document.getElementById('btn-save-content');
  const msgContainer = document.getElementById('site-content-msg');

  if (!jsonEditor || !btnSaveContent) return;

  let siteContentData = {
    hero: { eyebrow: "WELCOME", headline: "TEAM BROTHERS" },
    about: {},
    "services section": {},
    "work section": {},
    footer: {},
    settings: {}
  };
  let currentTabKey = 'hero';

  // Load content
  async function loadSiteContent() {
    try {
      const res = await fetch('/api/site-content');
      if (res.ok) {
        const data = await res.json();
        siteContentData = { ...siteContentData, ...data };
      }
      jsonEditor.value = JSON.stringify(siteContentData[currentTabKey] || {}, null, 2);
    } catch (err) {
      console.error('Failed to load site content', err);
    }
  }

  loadSiteContent();

  // Content Tabs UI switching
  const contentTabs = document.querySelectorAll('.content-tabs button');
  contentTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Validate current JSON before switching
      try {
        siteContentData[currentTabKey] = JSON.parse(jsonEditor.value);
      } catch (e) {
        msgContainer.className = 'message error';
        msgContainer.textContent = 'Please fix JSON errors before switching tabs: ' + e.message;
        msgContainer.style.display = 'block';
        return;
      }

      msgContainer.style.display = 'none';
      const key = tab.textContent.trim();
      currentTabKey = key;

      // Deactivate all
      contentTabs.forEach(t => {
        t.classList.remove('btn-primary');
        t.classList.add('btn-outline');
        t.style.borderColor = 'rgba(255,255,255,0.1)';
      });
      // Activate clicked
      tab.classList.remove('btn-outline');
      tab.classList.add('btn-primary');
      tab.style.borderColor = 'transparent';

      // Load section data
      jsonEditor.value = JSON.stringify(siteContentData[currentTabKey] || {}, null, 2);
    });
  });

  // Save content
  btnSaveContent.addEventListener('click', async () => {
    msgContainer.className = 'message';
    msgContainer.textContent = '';
    msgContainer.style.display = 'none';
    
    try {
      siteContentData[currentTabKey] = JSON.parse(jsonEditor.value);
    } catch (e) {
      msgContainer.className = 'message error';
      msgContainer.textContent = 'Invalid JSON: ' + e.message;
      msgContainer.style.display = 'block';
      return;
    }

    btnSaveContent.disabled = true;
    btnSaveContent.textContent = 'Saving...';

    try {
      const res = await fetch('/api/site-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteContentData)
      });
      
      if (res.ok) {
        msgContainer.className = 'message success';
        msgContainer.textContent = 'Site content saved successfully!';
        msgContainer.style.display = 'block';
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save');
      }
    } catch (err) {
      msgContainer.className = 'message error';
      msgContainer.textContent = err.message;
      msgContainer.style.display = 'block';
    } finally {
      btnSaveContent.disabled = false;
      btnSaveContent.textContent = 'Save content';
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// File Upload Logic Helper
function setupImageUpload(fileInputId, btnUploadId, textInputId) {
  const fileUpload = document.getElementById(fileInputId);
  const btnUpload = document.getElementById(btnUploadId);
  const imageInput = document.getElementById(textInputId);
  
  if (!fileUpload || !btnUpload || !imageInput) return;
  const dropZone = btnUpload.closest('.input-with-button');

  const handleFileUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    
    btnUpload.disabled = true;
    const originalText = btnUpload.innerHTML;
    btnUpload.innerHTML = 'Uploading...';

    try {
      const res = await fetch('/api/upload-media', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        imageInput.value = data.url;
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + err.message);
    } finally {
      btnUpload.disabled = false;
      btnUpload.innerHTML = originalText;
      fileUpload.value = '';
    }
  };

  btnUpload.addEventListener('click', () => {
    fileUpload.click();
  });

  fileUpload.addEventListener('change', (e) => {
    handleFileUpload(e.target.files[0]);
  });

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.border = '2px dashed var(--color-primary)';
      dropZone.style.opacity = '0.7';
    });
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.style.border = '';
      dropZone.style.opacity = '1';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.border = '';
      dropZone.style.opacity = '1';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupImageUpload('file-upload', 'btn-upload', 'image');
});// ... existing code ends here

async function fetchAndRenderStatistics() {
  const container = document.getElementById('statistics-container');
  if (!container) return;
  try {
    const res = await fetch('/api/statistics');
    if (!res.ok) throw new Error('Failed to fetch statistics');
    const records = await res.json();
    
    container.innerHTML = '';
    
    if (records.length === 0) {
      container.innerHTML = 'No statistics yet.';
      return;
    }
    
    records.forEach(record => {
      const item = document.createElement('div');
      item.className = 'record-item';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '12px 16px';
      item.style.background = 'rgba(255,255,255,0.05)';
      item.style.borderRadius = '8px';
      item.style.marginBottom = '12px';
      
      const info = document.createElement('div');
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.textAlign = 'left';
      
      const labelDiv = document.createElement('div');
      labelDiv.textContent = record.label;
      labelDiv.style.fontWeight = 'bold';
      labelDiv.style.fontSize = '1.1rem';
      labelDiv.style.color = '#fff';
      
      const valueDiv = document.createElement('div');
      valueDiv.textContent = record.value;
      valueDiv.style.color = 'var(--color-flare)';
      valueDiv.style.fontSize = '1.2rem';
      valueDiv.style.fontWeight = '800';
      valueDiv.style.marginTop = '4px';
      
      info.appendChild(labelDiv);
      info.appendChild(valueDiv);
      
      item.appendChild(info);
      container.appendChild(item);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = 'Error loading statistics.';
  }
}

async function fetchAndRenderCategories() {
  const container = document.getElementById('categories-container');
  if (!container) return;
  try {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    const records = await res.json();
    
    container.innerHTML = '';
    
    if (records.length === 0) {
      container.innerHTML = 'No categories yet.';
      return;
    }
    
    records.forEach(record => {
      const item = document.createElement('div');
      item.className = 'record-item';
      
      const info = document.createElement('div');
      info.style.flex = '1';
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.textAlign = 'left';
      
      const nameDiv = document.createElement('div');
      nameDiv.textContent = record.name;
      nameDiv.style.fontWeight = 'bold';
      nameDiv.style.fontSize = '1.1rem';
      nameDiv.style.color = '#fff';
      
      info.appendChild(nameDiv);
      
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '8px';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn-delete btn-edit'; // Reuse styling but change color
      editBtn.style.borderColor = '#3b82f6';
      editBtn.style.color = '#3b82f6';
      editBtn.textContent = 'Edit';
      editBtn.onclick = () => {
        document.getElementById('edit-category-id').value = record.id;
        document.getElementById('edit-category-name').value = record.name;
        document.getElementById('edit-category-form-container').style.display = 'block';
      };
      
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete';
      delBtn.textContent = 'Delete';
      delBtn.onclick = async () => {
        if (confirm('Are you sure you want to delete this category?')) {
          await fetch(`/api/categories/${record.id}`, { method: 'DELETE' });
          fetchAndRenderCategories();
        }
      };
      
      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(delBtn);

      item.appendChild(info);
      item.appendChild(actionsDiv);
      container.appendChild(item);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = 'Error loading categories.';
  }
}
// --- ONGOING EVENTS LOGIC ---

document.addEventListener('DOMContentLoaded', () => {
  // Toggle modals
  const btnShowNewEvent = document.getElementById('btn-show-new-event');
  if (btnShowNewEvent) {
    btnShowNewEvent.addEventListener('click', () => {
      document.getElementById('new-event-modal').style.display = 'block';
    });
  }
  const btnCancelNewEvent = document.getElementById('btn-cancel-new-event');
  if (btnCancelNewEvent) {
    btnCancelNewEvent.addEventListener('click', () => {
      document.getElementById('new-event-modal').style.display = 'none';
    });
  }
  const btnCancelEditEvent = document.getElementById('btn-cancel-edit-event');
  if (btnCancelEditEvent) {
    btnCancelEditEvent.addEventListener('click', () => {
      document.getElementById('edit-event-modal').style.display = 'none';
    });
  }

  // Upload handlers using existing helper
  setupImageUpload('event-file-upload', 'btn-event-upload', 'event-image');
  setupImageUpload('edit-event-file-upload', 'btn-edit-event-upload', 'edit-event-image');

  // New Event Submit
  const newEventForm = document.getElementById('new-event-form');
  if (newEventForm) {
    newEventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('event-title').value;
      const category = document.getElementById('event-category').value;
      const image = document.getElementById('event-image').value;
      const description = document.getElementById('event-description').value;
      const prize_pool = document.getElementById('event-prize-pool').value;
      const submitBtn = e.target.querySelector('.submit-btn');
      const statusMsg = document.getElementById('event-status-message');

      statusMsg.style.display = 'block';
      statusMsg.className = 'message';
      statusMsg.textContent = '';
      const prevText = submitBtn.textContent;
      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;

      if (!image.startsWith('http://') && !image.startsWith('https://') && !image.startsWith('uploads/')) {
        statusMsg.className = 'message error';
        statusMsg.textContent = 'Invalid image path. Please use the "Upload" button to select a file from your computer, or enter a valid web URL (https://...).';
        submitBtn.disabled = false;
        submitBtn.textContent = prevText;
        return;
      }

      try {
        const res = await fetch('/api/ongoing-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, category, image, description, prize_pool })
        });
        const data = await res.json();
        
        if (res.ok) {
          statusMsg.className = 'message success';
          statusMsg.textContent = 'Event successfully created!';
          document.getElementById('new-event-form').reset();
          fetchAndRenderEvents();
          fetchAndRenderOverview();
          
          setTimeout(() => {
            document.getElementById('new-event-modal').style.display = 'none';
            statusMsg.style.display = 'none';
          }, 1500);
        } else {
          throw new Error(data.error || 'Failed to save event');
        }
      } catch (err) {
        console.error(err);
        statusMsg.className = 'message error';
        statusMsg.textContent = err.message || 'An error occurred.';
      } finally {
        submitBtn.textContent = prevText;
        submitBtn.disabled = false;
      }
    });
  }

  // Edit Event Submit
  const editEventForm = document.getElementById('edit-event-form');
  if (editEventForm) {
    editEventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-event-id').value;
      const title = document.getElementById('edit-event-title').value;
      const category = document.getElementById('edit-event-category').value;
      const image = document.getElementById('edit-event-image').value;
      const description = document.getElementById('edit-event-description').value;
      const prize_pool = document.getElementById('edit-event-prize-pool').value;
      const submitBtn = document.getElementById('btn-save-event-edit');
      const errorMsg = document.getElementById('edit-event-error-msg');

      errorMsg.style.display = 'none';
      const prevText = submitBtn.textContent;
      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;

      if (!image.startsWith('http://') && !image.startsWith('https://') && !image.startsWith('uploads/')) {
        errorMsg.className = 'message error';
        errorMsg.textContent = 'Invalid image path. Please use the "Upload" button to select a file from your computer, or enter a valid web URL (https://...).';
        errorMsg.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = prevText;
        return;
      }

      try {
        const res = await fetch('/api/ongoing-events/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, category, image, description, prize_pool })
        });
        if (res.ok) {
          document.getElementById('edit-event-modal').style.display = 'none';
          fetchAndRenderEvents();
          fetchAndRenderOverview();
        } else {
          const data = await res.json();
          errorMsg.textContent = data.error || 'Failed to update event';
          errorMsg.style.display = 'block';
        }
      } catch (err) {
        console.error(err);
        errorMsg.textContent = 'An error occurred. Please try again.';
        errorMsg.style.display = 'block';
      } finally {
        submitBtn.textContent = prevText;
        submitBtn.disabled = false;
      }
    });
  }
});

async function fetchAndRenderEvents() {
  const container = document.getElementById('events-container');
  if (!container) return;
  container.innerHTML = '<p style="color: var(--color-mute);">Loading records...</p>';

  try {
    const res = await fetch('/api/ongoing-events');
    const records = await res.json();

    container.innerHTML = '';
    if (records.length === 0) {
      container.innerHTML = '<p style="color: var(--color-mute);">No events found.</p>';
      return;
    }

    records.forEach(record => {
      const item = document.createElement('div');
      item.className = 'record-item';
      
      const contentWrapper = document.createElement('div');
      contentWrapper.style.display = 'flex';
      contentWrapper.style.alignItems = 'center';
      contentWrapper.style.gap = '16px';
      
      const img = document.createElement('img');
      let imageSrc = record.image || 'https://via.placeholder.com/80';
      if (record.image && !record.image.startsWith('http') && !record.image.startsWith('uploads/')) {
        imageSrc = '/' + record.image;
      }
      img.src = imageSrc;
      img.alt = record.title;
      img.style.width = '60px';
      img.style.height = '60px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '6px';

      const info = document.createElement('div');
      info.className = 'record-info';
      
      const title = document.createElement('div');
      title.className = 'record-title';
      title.textContent = record.title;
      
      const category = document.createElement('div');
      category.className = 'record-category';
      category.textContent = record.category || 'Uncategorized';
      
      info.appendChild(title);
      info.appendChild(category);
      
      contentWrapper.appendChild(img);
      contentWrapper.appendChild(info);
      
      item.appendChild(contentWrapper);

      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '8px';
      
      const doneBtn = document.createElement('button');
      doneBtn.className = 'btn-delete btn-edit';
      doneBtn.style.borderColor = '#10b981';
      doneBtn.style.color = '#10b981';
      doneBtn.textContent = 'Done';
      doneBtn.onclick = async () => {
        if (confirm('Mark this event as done and transfer to projects?')) {
          const prevText = doneBtn.textContent;
          doneBtn.textContent = 'Moving...';
          doneBtn.disabled = true;
          try {
            const res = await fetch(`/api/ongoing-events/${record.id}/done`, { method: 'POST' });
            if (res.ok) {
              fetchAndRenderEvents();
              if (typeof fetchAndRenderWorks === 'function') fetchAndRenderWorks();
              fetchAndRenderOverview();
            } else {
              const data = await res.json();
              alert(data.error || 'Failed to move event');
              doneBtn.textContent = prevText;
              doneBtn.disabled = false;
            }
          } catch(e) {
            console.error(e);
            alert('Failed to move event');
            doneBtn.textContent = prevText;
            doneBtn.disabled = false;
          }
        }
      };
      
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-delete btn-edit';
      editBtn.style.borderColor = '#3b82f6';
      editBtn.style.color = '#3b82f6';
      editBtn.textContent = 'Edit';
      editBtn.onclick = () => {
        document.getElementById('edit-event-id').value = record.id;
        document.getElementById('edit-event-title').value = record.title;
        document.getElementById('edit-event-category').value = record.category || '';
        document.getElementById('edit-event-image').value = record.image || '';
        document.getElementById('edit-event-description').value = record.description || '';
        document.getElementById('edit-event-prize-pool').value = record.prize_pool || '';
        document.getElementById('edit-event-error-msg').style.display = 'none';
        document.getElementById('edit-event-modal').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete';
      delBtn.textContent = 'Delete';
      delBtn.onclick = async () => {
        if (confirm('Are you sure you want to delete this event?')) {
          const btnContent = delBtn.innerHTML;
          delBtn.innerHTML = 'Deleting...';
          delBtn.disabled = true;
          try {
            await fetch(`/api/ongoing-events/${record.id}`, { method: 'DELETE' });
            fetchAndRenderEvents();
            fetchAndRenderOverview();
          } catch(e) {
            console.error(e);
            alert('Failed to delete');
            delBtn.innerHTML = btnContent;
            delBtn.disabled = false;
          }
        }
      };
      
      actionsDiv.appendChild(doneBtn);
      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(delBtn);

      item.appendChild(actionsDiv);
      container.appendChild(item);
    });
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p style="color: var(--color-mute);">Error loading events.</p>';
  }
}
