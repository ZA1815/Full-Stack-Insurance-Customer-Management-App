class App {
    constructor() {
        this.currentUser = null;
        this.customers = [];
        this.currentCustomerId = null;
        this.initializeApp();
    }

    initializeApp() {
        this.cacheDOMElements();
        this.bindEvents();
        this.checkLoginState();
    }

    cacheDOMElements() {
        this.loginPage = document.getElementById('loginPage');
        this.customerPage = document.getElementById('customerPage');
        this.loginForm = document.getElementById('loginForm');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.customerForm = document.getElementById('customerForm');
        this.newBtn = document.getElementById('newBtn');
        this.deleteBtn = document.getElementById('deleteBtn');
        this.searchBtn = document.getElementById('searchBtn');
        this.customerListDiv = document.getElementById('customerList');
        this.loginError = document.getElementById('loginError');
        this.formError = document.getElementById('formError');
        this.formSuccess = document.getElementById('formSuccess');
        this.employeeNameSpan = document.getElementById('employeeName');
    }

    bindEvents() {
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
        this.customerForm.addEventListener('submit', (e) => this.handleCustomerSave(e));
        this.newBtn.addEventListener('click', () => this.clearForm());
        this.deleteBtn.addEventListener('click', () => this.handleCustomerDelete());
        this.searchBtn.addEventListener('click', () => this.handleSearch());
    }

    // Using sessionStorage to persist login across page refreshes
    checkLoginState() {
        const user = sessionStorage.getItem('user');
        if (user) {
            this.currentUser = JSON.parse(user);
            this.showCustomerPage();
        } else {
            this.showLoginPage();
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = this.loginForm.username.value;
        const password = this.loginForm.password.value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.employee;
                sessionStorage.setItem('user', JSON.stringify(this.currentUser));
                this.showCustomerPage();
            } else {
                this.loginError.textContent = data.message;
                this.loginError.style.display = 'block';
            }
        } catch (error) {
            this.loginError.textContent = 'Network error. Could not connect to server.';
            this.loginError.style.display = 'block';
        }
    }

    async handleLogout() {
        await fetch('/api/logout', { method: 'POST' });
        this.currentUser = null;
        sessionStorage.removeItem('user');
        this.showLoginPage();
    }

    async loadCustomers(searchTerm = '', searchField = '') {
        this.customerListDiv.innerHTML = '<div class="loading">Loading customers...</div>';
        let url = '/api/customers';
        if (searchTerm && searchField) {
            url += `?search=${encodeURIComponent(searchTerm)}&searchField=${searchField}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();
            if (response.ok) {
                this.customers = data.customers;
                this.displayCustomers();
            } else {
                if (response.status === 401) this.handleLogout();
            }
        } catch (error) {
            this.customerListDiv.innerHTML = '<div class="no-customers">Error loading customers.</div>';
        }
    }

    displayCustomers() {
        if (this.customers.length === 0) {
            this.customerListDiv.innerHTML = '<div class="no-customers">No customers found.</div>';
            return;
        }
        this.customerListDiv.innerHTML = '';
        this.customers.forEach(customer => {
            const item = document.createElement('div');
            item.className = 'customer-item';
            item.dataset.id = customer.id;

            item.innerHTML = `
                <div class="customer-name">${customer.name_insured}</div>
                <div class="customer-details">
                    Policy: ${customer.policy_number} | 
                    Carrier: ${customer.carrier} | 
                    Premium: $${parseFloat(customer.premium).toFixed(2)} | 
                    <span class="status-${customer.status}">${customer.status.toUpperCase()}</span> | 
                    <span class="alert-${customer.alert}">${customer.alert === 'due' ? 'DUE' : 'NOT DUE'}</span><br>
                    Product: ${customer.product} | Last Modified By: ${customer.last_modified_by}
                </div>`;
                
            item.addEventListener('click', () => this.loadCustomerToForm(customer));
            this.customerListDiv.appendChild(item);
        });
}

    async handleCustomerSave(e) {
        e.preventDefault();
        const formData = new FormData(this.customerForm);
        const customerData = Object.fromEntries(formData.entries());

        const isUpdate = !!this.currentCustomerId;
        const url = isUpdate ? `/api/customers/${this.currentCustomerId}` : '/api/customers';
        const method = isUpdate ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData)
            });
            const data = await response.json();

            if (response.ok) {
                this.showSuccess(data.message);
                this.clearForm();
                this.loadCustomers();
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            this.showError('A network error occurred.');
        }
    }

    async handleCustomerDelete() {
        if (!this.currentCustomerId) return;
        if (confirm('Are you sure you want to delete this customer?')) {
            const response = await fetch(`/api/customers/${this.currentCustomerId}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok) {
                this.showSuccess(data.message);
                this.clearForm();
                this.loadCustomers();
            } else {
                this.showError(data.message);
            }
        }
    }

    handleSearch() {
        const name = document.getElementById('searchName').value.trim();
        const policy = document.getElementById('searchPolicy').value.trim();
        if (name) {
            this.loadCustomers(name, 'name');
        } else if (policy) {
            this.loadCustomers(policy, 'policy');
        } else {
            this.loadCustomers();
        }
    }

    loadCustomerToForm(customer) {
        this.currentCustomerId = customer.id;
        for (const key in customer) {
            if (this.customerForm.elements[key]) {
                let value = customer[key];
                // Handle date formatting for input fields (ISO format -> YYYY-MM-DD)
                if (this.customerForm.elements[key].type === 'date' && value) {
                    value = value.split('T')[0];
                }
                this.customerForm.elements[key].value = value;
            }
        }
        this.customerForm.elements.name_insured.value = customer.name_insured;
        this.customerForm.elements.contact_person.value = customer.contact_person;
        this.customerForm.elements.phone_number.value = customer.phone_number;
        this.customerForm.elements.policy_number.value = customer.policy_number;
        this.customerForm.elements.effective_date.value = customer.effective_date.split('T')[0];
        this.customerForm.elements.expiration_date.value = customer.expiration_date.split('T')[0];
        this.customerForm.elements.additional_comments.value = customer.additional_comments;

        document.getElementById('formTitle').textContent = 'Edit Customer';
        document.getElementById('saveBtn').textContent = 'Update Customer';
        this.deleteBtn.classList.remove('hidden');
    }

    clearForm() {
        this.currentCustomerId = null;
        this.customerForm.reset();
        document.getElementById('formTitle').textContent = 'Add New Customer';
        document.getElementById('saveBtn').textContent = 'Save Customer';
        this.deleteBtn.classList.add('hidden');
        this.hideMessages();
    }

    showLoginPage() {
        this.loginPage.classList.remove('hidden');
        this.customerPage.classList.add('hidden');
    }

    showCustomerPage() {
        this.loginPage.classList.add('hidden');
        this.customerPage.classList.remove('hidden');
        this.employeeNameSpan.textContent = this.currentUser.full_name;
        this.loadCustomers();
        this.clearForm();
    }

    showError(message) {
        this.formError.textContent = message;
        this.formError.style.display = 'block';
        this.formSuccess.style.display = 'none';
    }

    showSuccess(message) {
        this.formSuccess.textContent = message;
        this.formSuccess.style.display = 'block';
        this.formError.style.display = 'none';
        setTimeout(() => this.hideMessages(), 3000);
    }

    hideMessages() {
        this.formError.style.display = 'none';
        this.formSuccess.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => new App());