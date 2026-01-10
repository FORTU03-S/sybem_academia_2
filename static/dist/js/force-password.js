async function changePassword(event) {
  event.preventDefault();

  const password = document.getElementById("new-password").value;
  const confirm = document.getElementById("confirm-password").value;

  if (password !== confirm) {
    alert("Les mots de passe ne correspondent pas");
    return;
  }

  const token = localStorage.getItem("access_token");
  

  // Remplacez cette ligne :
// const response = await fetch("http://localhost:8000/api/users/force-change-password/", {

// Par celle-ci :
const response = await fetch("http://localhost:8000/api/users/auth/change-password/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      password: password,
      confirm_password: confirm
    })
});

  if (!response.ok) {
    const err = await response.json();
    alert(err.detail || "Erreur lors du changement");
    return;
  }

  // Nettoyage sécurité
  localStorage.setItem("must_change_password", "false");

  alert("Mot de passe modifié avec succès");
  window.location.href = "/static/dist/html/login.html";
}
