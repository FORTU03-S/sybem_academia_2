const API_STUDENTS = "/api/pupils/students/";
const TOKEN = localStorage.getItem("access");

document.getElementById("studentForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  // Valeurs par défaut backend
  formData.append("status", "active");

  const res = await fetch(API_STUDENTS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`
    },
    body: formData
  });

  if (!res.ok) {
    const errData = await res.json();
    console.error(errData);

    // On cherche le message d'erreur
    let errorMessage = "Une erreur est survenue lors de l'enregistrement.";
    
    // Si c'est l'erreur de doublon (IntegrityError) ou une erreur de validation
    if (errData.detail) {
      errorMessage = errData.detail;
    } else if (typeof errData === 'object') {
      // Pour les erreurs de champs spécifiques (ex: "Ce champ est obligatoire")
      errorMessage = Object.values(errData).flat().join(" | ");
    }

    // Affichage pro dans le HTML
    const errorDiv = document.getElementById("form-error");
    errorDiv.textContent = errorMessage;
    errorDiv.classList.remove("hidden");
    
    // Scroll vers le haut pour que l'utilisateur voie le message
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Si tout est OK, rediriger vers la liste des étudiants
  window.location.href = "students_list.html";
});