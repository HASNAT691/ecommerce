document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/admin/api/analytics');
        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error('Failed to load real-time analytics data');
            return;
        }

        // 1. Sales Performance Chart (Bar Chart)
        const salesCtx = document.getElementById('salesChart').getContext('2d');
        new Chart(salesCtx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Sales (PKR)',
                    data: data.salesValues,
                    backgroundColor: '#6366f1',
                    borderColor: '#6366f1',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) { return 'Rs. ' + value.toLocaleString(); }
                        }
                    }
                }
            }
        });

        // 2. User Growth Chart (Line Chart)
        const userGrowthCtx = document.getElementById('userGrowthChart').getContext('2d');
        new Chart(userGrowthCtx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'New Signups',
                    data: data.userValues,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });

        // 3. Product Categories Performance (Pie/Doughnut Chart)
        const activeCategories = data.categoriesList.filter(c => c.productCount > 0 || c.revenue > 0);
        const pieLabels = activeCategories.length > 0 ? activeCategories.map(c => c.name) : ['No Categories Active'];
        const pieData = activeCategories.length > 0 ? activeCategories.map(c => c.productCount) : [1];
        const pieColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

        const productCtx = document.getElementById('productPerformanceChart').getContext('2d');
        new Chart(productCtx, {
            type: 'doughnut',
            data: {
                labels: pieLabels,
                datasets: [{
                    data: pieData,
                    backgroundColor: pieColors.slice(0, Math.max(pieLabels.length, 1)),
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        // 4. Populate Product Categories Table
        const categoriesTableBody = document.getElementById('categoriesTableBody');
        categoriesTableBody.innerHTML = '';
        if (data.categoriesList && data.categoriesList.length > 0) {
            data.categoriesList.forEach(cat => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${cat.name}</strong></td>
                    <td>${cat.productCount} products</td>
                    <td>PKR ${cat.revenue.toLocaleString()}</td>
                `;
                categoriesTableBody.appendChild(tr);
            });
        } else {
            categoriesTableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-muted">No categories defined yet.</td>
                </tr>
            `;
        }

        // 5. Populate Sales Data Table
        const salesTableBody = document.getElementById('salesTableBody');
        salesTableBody.innerHTML = '';
        if (data.salesList && data.salesList.length > 0) {
            data.salesList.forEach(sale => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${sale.title}</td>
                    <td>${sale.quantity}</td>
                    <td>PKR ${sale.revenue.toLocaleString()}</td>
                    <td><span class="badge bg-light text-dark">${sale.region}</span></td>
                `;
                salesTableBody.appendChild(tr);
            });
        } else {
            salesTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted">No sales recorded yet.</td>
                </tr>
            `;
        }

    } catch (error) {
        console.error('Error fetching analytics data:', error);
    }
});
