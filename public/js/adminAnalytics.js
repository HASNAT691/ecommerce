
// Sales Performance Chart (Bar Chart)
var ctx = document.getElementById('salesChart').getContext('2d');
var salesChart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'Sales ($)',
            data: [15000, 20000, 18000, 22000, 25000, 30000],
            backgroundColor: '#00bfff',
            borderColor: '#00bfff',
            borderWidth: 1
        }]
    },
    options: {
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});

// User Growth Chart (Line Chart)
var ctx2 = document.getElementById('userGrowthChart').getContext('2d');
var userGrowthChart = new Chart(ctx2, {
    type: 'line',
    data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'New Users',
            data: [50, 70, 120, 150, 200, 250],
            borderColor: '#28a745',
            backgroundColor: 'rgba(40, 167, 69, 0.2)',
            borderWidth: 2
        }]
    },
    options: {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});

// Product Performance Chart (Pie Chart)
var ctx3 = document.getElementById('productPerformanceChart').getContext('2d');
var productPerformanceChart = new Chart(ctx3, {
    type: 'pie',
    data: {
        labels: ['Clothing', 'Shoes', 'Cosmetics'],
        datasets: [{
            label: 'Product Categories',
            data: [40, 35, 25],
            backgroundColor: ['#00bfff', '#ff7f50', '#ffcc00'],
            borderColor: ['#fff', '#fff', '#fff'],
            borderWidth: 1
        }]
    }
});
