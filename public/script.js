function toggleButton() {
    const checkbox = document.getElementById('agree');
    const button = document.getElementById('loginButton');
    button.disabled = !checkbox.checked;
}

// 登录表单提交事件处理
document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    let account = document.getElementById('loginUsername').value;
    let password = document.getElementById('loginPassword').value;

    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ account, password })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                let redirectUrl = "example.html";
                window.location.href = redirectUrl;
            } else {
                let loginMessage = document.getElementById('loginMessage');
                loginMessage.innerText = '錯囉小孩';
                loginMessage.style.opacity = 1;
                setTimeout(() => {
                    loginMessage.style.opacity = 0;
                }, 3000);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            let loginMessage = document.getElementById('loginMessage');
            loginMessage.innerText = 'An error occurred';
            loginMessage.style.opacity = 1;
            setTimeout(() => {
                loginMessage.style.opacity = 0;
            }, 3000);
        });
});