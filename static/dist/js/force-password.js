async function changePassword(event) {
  event.preventDefault();

  const password = document.getElementById("new-password").value;
  const confirm = document.getElementById("confirm-password").value;

  if (password !== confirm) {
    alert("Les mots de passe ne correspondent pas");
    return;
  }

  const token = localStorage.getItem("access_token");

  const response = await fetch("http://localhost:8000/api/users/change-password/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ password })
  });

  if (!response.ok) {
    alert("Erreur lors du changement");
    return;
  }

  localStorage.setItem("must_change_password", "false");

  alert("Mot de passe modifié");
  window.location.href = "/static/dist/html/login.html";
}
