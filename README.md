# Part-1: Credit Risk Modeling & Classification 

This notebook provides a comprehensive workflow for credit risk modeling and binary classification using a real-world banking dataset. The workflow includes data cleaning, feature engineering, imputation, outlier detection, class imbalance handling, model training, and evaluation with advanced techniques.

## Main Steps:

1. **Data Loading & Exploration**
   - Load the dataset using pandas
   - Explore data types, missing values, and distributions

2. **Data Cleaning & Feature Engineering**
   - Convert categorical and date features
   - Create new features (e.g., account age in months)
   - Outlier detection and removal using IsolationForest
   - Impute missing values using KMeans clustering

3. **Class Imbalance Handling**
   - Use class weights in models

4. **Model Training & Evaluation**
   - CatBoost is the main model (other models: XGBoost, LightGBM, TabNet, H2O AutoML for comparison)
   - Threshold setting and optimization using Optuna for best F1-score
   - Feature importance and SHAP analysis

5. **Best Practices**
   - All code is modular and can be adapted for other tabular classification problems
   - Notebook cells are well-commented for clarity

## Requirements
- Python 3.8+
- pandas, numpy, scikit-learn, matplotlib, xgboost, lightgbm, catboost, imbalanced-learn, ctgan, h2o, pytorch-tabnet, shap, tensorflow, tqdm

Install missing packages using pip, e.g.:
```
pip install pandas numpy scikit-learn matplotlib xgboost lightgbm catboost imbalanced-learn ctgan h2o pytorch-tabnet shap tensorflow tqdm
```

## Usage
- Run the notebook cell by cell.
- Adjust parameters (e.g., contamination, SMOTE ratio, model hyperparameters) as needed.
- Review model performance and select the best approach for your use case.

---
For questions or improvements, please contact the notebook author or your team lead.

# 🏦 SBI Hackathon Part 2

This repository contains the **frontend and backend code** for the **SBI Hackathon Project**.  
It includes two complete full-stack solutions:

- 🔵 **Soln 1** – Predicting Last known defaulter's location using SBI password reset feature 
- 🟢 **Soln 2** – Predicting Last known defaulter's location using tower-connections logs 

Both versions support user registration, event logging (UPI, login, app open), and admin-level analytics and monitoring.

---



# 🔵 Soln 1 – Django + React

Django is used as the backend framework for user event tracking, admin dashboards, and analytics, paired with a React frontend.

## 🛠️ Installation & Setup

### ✅ Prerequisites

- Python 3.9+
- Virtual environment (recommended)
- pip package manager

---

### ⚙️ Setup Instructions

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/SBI_Hackathon.git
   cd SBI_Hackathon
   cd django_backend
   ```

2. **Create and activate a virtual environment**

   ```bash
   python -m venv venv

   # For Windows
   venv\Scripts\activate

   # For Linux/Mac
   source venv/bin/activate
   ```

3. **Install Python dependencies**

   ```bash
   pip install -r ../requirements.txt
   ```

4. **Apply migrations and create a superuser**

   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   ```

5. **Start the development server**

   ```bash
   python manage.py runserver
   ```

6. **Access the application**
   - User Interface: http://127.0.0.1:8000/
   - Admin Panel: http://127.0.0.1:8000/admin/

---

## 🎮 Usage Guide

### 👤 For Regular Users

- Register using Aadhaar, email, and phone number.
- Login and generate events like:
  - Login Event
  - UPI Event
  - App Open Event

### 🛂 For SBI Authorities

- Login with admin credentials:
  - Username: `authority`
  - Password: `test123`
- Access the dashboard for:
  - Clustering analysis
  - Monitoring suspicious/defaulter activities
  - Exporting reports

---

# 🟢 Soln 2 – Node.js + React

An alternative solution using a lightweight Node.js backend for API handling, paired with the same React frontend.

## 🚀 Installation & Setup

1. **Clone the repository and navigate into the project**

   ```bash
   git clone https://github.com/your-username/SBI_Hackathon.git
   cd SBI_Hackathon
   cd sbi_par2_soln2
   ```

2. **Backend Setup (Node.js)**

   ```bash
   cd backend

   # Install dependencies
   npm install

   # Start backend server
   node server.js
   ```

3. **Frontend Setup (React)**

   Open a **new terminal**:

   ```bash
   cd frontend

   # Install dependencies
   npm install

   # Start React app
   npm start
   ```

4. **Access the app**

   - React frontend: http://localhost:3000/
   - Node.js backend: http://localhost:5000/ (or the port you configured)

---

## ⚙️ Requirements

- Python 3.9+
- pip
- Node.js v14+
- npm v6+

