document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("userForm");
    const result = document.getElementById("result");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        result.textContent = "";
        result.className = "";

        const formData = new FormData(form);

        // 🔹 Récupération du rôle (radio)
        const role = formData.get("role");

        if (!role) {
            result.textContent = "❌ Veuillez sélectionner un rôle.";
            result.className = "text-red-600";
            return;
        }

        // 🔹 Payload final envoyé à l’API
        const payload = {
            first_name: formData.get("first_name"),
            middle_name: formData.get("middle_name"),
            last_name: formData.get("last_name"),
            email: formData.get("email"),
            mode: formData.get("mode"),
            role: role
        };

        try {
            await apiRequest("/api/school/users/", "POST", payload);

            result.textContent =
                payload.mode === "invite"
                    ? "✅ Invitation envoyée avec succès"
                    : "✅ Utilisateur créé avec succès";

            result.className = "text-green-600 font-medium";

            form.reset();

            // Masquer l’aperçu photo si existant
            const preview = document.getElementById("photoPreview");
            if (preview) preview.classList.add("hidden");

        } catch (error) {
            result.textContent = "❌ " + (error.message || "Erreur inconnue");
            result.className = "text-red-600 font-medium";
        }
    });
});
