

document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("inviteForm");
  const errorBox = document.getElementById("errorBox");
  const successBox = document.getElementById("successBox");

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    errorBox.textContent = "Lien d'invitation invalide ou manquant.";
    errorBox.classList.remove("hidden");
    form.style.display = "none";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    errorBox.classList.add("hidden");
    successBox.classList.add("hidden");

    const first_name = document.getElementById("first_name").value.trim();
    const last_name = document.getElementById("last_name").value.trim();
    const password = document.getElementById("password").value;
    const confirm_password = document.getElementById("confirm_password").value;

    if (password !== confirm_password) {
      errorBox.textContent = "Les mots de passe ne correspondent pas.";
      errorBox.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch("/api/users/accept-invitation/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token,
          first_name,
          last_name,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        errorBox.textContent = data.detail || "Erreur lors de l'activation.";
        errorBox.classList.remove("hidden");
        return;
      }

      successBox.textContent = "Compte activé avec succès. Vous pouvez vous connecter.";
      successBox.classList.remove("hidden");
      form.reset();

      setTimeout(() => {
        window.location.href = "/static/dist/html/login.html";
      }, 2000);

    } catch (err) {
      errorBox.textContent = "Erreur serveur. Réessayez plus tard.";
      errorBox.classList.remove("hidden");
    }
  });

});
