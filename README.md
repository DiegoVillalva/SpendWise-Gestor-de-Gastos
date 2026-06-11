# SpendWise — Gestor de Gastos Personales

Aplicación web moderna para gestionar tus gastos, ingresos y presupuestos personales.
Construida con Python + Flask + SQLite.

---

## Configuración rápida

### 1. Requisitos
- Python 3.9 o superior
- pip

### 2. Instalar dependencias

```bash
cd expense-manager
pip install -r requirements.txt
```

### 3. Ejecutar la aplicación

```bash
python app.py
```

Abre tu navegador en: **http://localhost:5000**

---

## 📁 Estructura del proyecto

```
expense-manager/
├── app.py                  # Backend Flask + API REST
├── requirements.txt        # Dependencias Python
├── data/
│   └── expenses.db         # Base de datos SQLite (se crea automáticamente)
├── templates/
│   └── index.html          # SPA principal
└── static/
    ├── css/
    │   └── style.css       # Estilos (dark fintech)
    └── js/
        └── app.js          # Lógica del frontend
```

---

## Funcionalidades

| Sección        | Descripción |
|---------------|-------------|
| **Dashboard**  | KPIs del mes, gráfica de tendencia 6 meses, desglose por categoría, transacciones recientes |
| **Gastos**     | Listado filtrable, agregar / editar / eliminar gastos |
| **Ingresos**   | Registro de ingresos por fuente |
| **Presupuestos** | Límite mensual por categoría con barra de progreso y alertas |

### Categorías disponibles
🍔 Alimentación · 🚗 Transporte · 🏠 Vivienda · 💊 Salud · 🎬 Entretenimiento · 🛍️ Compras · 📚 Educación · 💰 Ahorros · 📦 Otros

---

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/expenses` | Listar gastos (filtros: `month`, `category`, `limit`) |
| POST | `/api/expenses` | Crear gasto |
| PUT | `/api/expenses/<id>` | Actualizar gasto |
| DELETE | `/api/expenses/<id>` | Eliminar gasto |
| GET | `/api/income` | Listar ingresos |
| POST | `/api/income` | Crear ingreso |
| DELETE | `/api/income/<id>` | Eliminar ingreso |
| GET | `/api/budgets` | Ver presupuestos |
| POST | `/api/budgets` | Guardar presupuesto |
| GET | `/api/stats/summary` | Estadísticas del mes |

---

## Extensiones posibles

- Exportar a CSV/Excel
- Múltiples usuarios con autenticación
- Notificaciones por correo cuando se supera el presupuesto
- Modo oscuro/claro
- Importar extractos bancarios

---

## Tecnologías

- **Backend:** Python, Flask, SQLite
- **Frontend:** HTML5, CSS3 (custom), Vanilla JS
- **Gráficas:** Chart.js 4
- **Tipografía:** Inter + Space Grotesk (Google Fonts)
