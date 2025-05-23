import './style.css';
import { supabase } from './src/supabase.js';
import { redirectToCheckout } from './src/stripe.ts';
import { products } from './src/stripe-config.ts';

let currentUser = null;

// DOM Elements
const app = document.querySelector('#app');

// Initialize the app
async function init() {
  // Check current session
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user;
  
  handleRoute();
  if (currentUser) {
    loadTodos();
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user;
    handleRoute();
    if (currentUser) {
      loadTodos();
    }
  });

  // Handle navigation
  window.addEventListener('popstate', handleRoute);
}

// Handle routing
function handleRoute() {
  const path = window.location.pathname;
  
  switch (path) {
    case '/success':
      renderSuccessPage();
      break;
    case '/cancel':
      renderCancelPage();
      break;
    default:
      renderApp();
  }
}

// Render the success page
async function renderSuccessPage() {
  if (!currentUser) {
    window.location.href = '/';
    return;
  }

  const { data: orders, error } = await supabase
    .from('stripe_user_orders')
    .select('*')
    .order('order_date', { ascending: false })
    .limit(1);

  const order = orders?.[0];

  app.innerHTML = `
    <div class="success-page">
      <h1>Payment Successful!</h1>
      ${order ? `
        <div class="order-details">
          <h2>Order Details</h2>
          <p>Order ID: ${order.order_id}</p>
          <p>Amount: ${(order.amount_total / 100).toFixed(2)} ${order.currency.toUpperCase()}</p>
          <p>Status: ${order.order_status}</p>
          <p>Date: ${new Date(order.order_date).toLocaleDateString()}</p>
        </div>
      ` : ''}
      <a href="/" class="btn-primary">Return to Home</a>
    </div>
  `;
}

// Render the cancel page
function renderCancelPage() {
  app.innerHTML = `
    <div class="cancel-page">
      <h1>Payment Cancelled</h1>
      <p>Your payment was cancelled. No charges were made.</p>
      <a href="/" class="btn-primary">Return to Home</a>
    </div>
  `;
}

// Render the main app
function renderApp() {
  app.innerHTML = `
    <div class="app-bar">
      <h1 class="app-title">Super Todo App</h1>
    </div>
    ${currentUser ? `
      <div class="auth-container">
        <p>Welcome, ${currentUser.email}</p>
        <button onclick="window.handleSignOut()" class="btn-primary">Sign Out</button>
      </div>
      <div class="todo-container">
        <form class="todo-form" onsubmit="window.handleAddTodo(event)">
          <input type="text" class="todo-input" placeholder="Add a new todo..." required>
          <button type="submit">Add Todo</button>
        </form>
        <ul class="todo-list" id="todoList"></ul>
      </div>
    ` : `
      <div class="auth-container">
        <div id="authForms">
          <form id="loginForm" class="auth-form" onsubmit="window.handleSignIn(event)">
            <h2>Login</h2>
            <div class="form-group">
              <label for="loginEmail">Email</label>
              <input type="email" id="loginEmail" required>
            </div>
            <div class="form-group">
              <label for="loginPassword">Password</label>
              <input type="password" id="loginPassword" required>
            </div>
            <button type="submit" class="btn-primary">Login</button>
            <p class="auth-toggle">
              Don't have an account? 
              <a href="#" onclick="window.toggleForm('register')">Register</a>
            </p>
          </form>

          <form id="registerForm" class="auth-form" style="display: none" onsubmit="window.handleSignUp(event)">
            <h2>Register</h2>
            <div class="form-group">
              <label for="registerEmail">Email</label>
              <input type="email" id="registerEmail" required>
            </div>
            <div class="form-group">
              <label for="registerPassword">Password</label>
              <input type="password" id="registerPassword" required>
            </div>
            <button type="submit" class="btn-secondary">Register</button>
            <p class="auth-toggle">
              Already have an account? 
              <a href="#" onclick="window.toggleForm('login')">Login</a>
            </p>
          </form>
        </div>
      </div>
    `}
  `;
}

// Load todos from Supabase
async function loadTodos() {
  const { data: todos, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading todos:', error);
    return;
  }

  const todoList = document.getElementById('todoList');
  if (!todoList) return;

  todoList.innerHTML = todos.map(todo => `
    <li class="todo-item">
      <input 
        type="checkbox" 
        class="todo-checkbox" 
        ${todo.is_complete ? 'checked' : ''} 
        onchange="window.handleToggleTodo('${todo.id}', this.checked)"
      >
      <span class="todo-text ${todo.is_complete ? 'completed' : ''}">${todo.title}</span>
      <button class="delete-btn" onclick="window.handleDeleteTodo('${todo.id}')">Delete (1.00 CHF)</button>
    </li>
  `).join('');
}

// Toggle between login and register forms
window.toggleForm = (formType) => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
  if (formType === 'register') {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  } else {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  }
};

// Auth handlers
window.handleSignUp = async (event) => {
  event.preventDefault();
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert('Error signing up: ' + error.message);
  } else {
    alert('Check your email for the confirmation link!');
    window.toggleForm('login');
  }
};

window.handleSignIn = async (event) => {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert('Error signing in: ' + error.message);
  }
};

window.handleSignOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  } catch (error) {
    console.error('Error during sign out:', error);
  } finally {
    // Force reload to clear any invalid session state
    window.location.reload();
  }
};

// Todo handlers
window.handleAddTodo = async (event) => {
  event.preventDefault();
  const input = event.target.querySelector('input');
  const title = input.value.trim();
  
  const { error } = await supabase
    .from('todos')
    .insert([{ title, user_id: currentUser.id }]);

  if (error) {
    alert('Error adding todo: ' + error.message);
  } else {
    input.value = '';
    loadTodos();
  }
};

window.handleToggleTodo = async (id, isComplete) => {
  const { error } = await supabase
    .from('todos')
    .update({ is_complete: isComplete })
    .eq('id', id);

  if (error) {
    alert('Error updating todo: ' + error.message);
    loadTodos(); // Reload to revert the checkbox
  }
};

window.handleDeleteTodo = async (id) => {
  try {
    await redirectToCheckout(
      products.deleteTodos.priceId,
      'payment',
      { todoId: id }
    );
  } catch (error) {
    console.error('Error initiating delete payment:', error);
    alert('Error initiating payment. Please try again.');
  }
};

// Initialize the app
init();