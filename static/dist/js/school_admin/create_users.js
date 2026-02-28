document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("userForm");
    const result = document.getElementById("result");
    const rolesContainer = document.getElementById("rolesContainer");
    const submitBtn = form.querySelector("button[type='submit']");

    async function loadRoles() {
        rolesContainer.innerHTML =
            "<p class='text-sm text-gray-500'>Chargement des rôles...</p>";

        try {
            const roles = await apiRequest("/api/school/roles/", "GET");

            rolesContainer.innerHTML = "";

            if (!Array.isArray(roles) || roles.length === 0) {
                rolesContainer.innerHTML =
                    "<p class='text-sm text-gray-500'>Aucun rôle disponible</p>";
                return;
            }

            roles.forEach(role => {
                // Sécurité 
                if (!role.id || !role.name) return;

                const label = document.createElement("label");
                label.className =
                    "flex items-center gap-2 p-2 border rounded-lg cursor-pointer " +
                    "hover:bg-gray-50 dark:hover:bg-slate-700";

                label.innerHTML = `
                    <input
                        type="checkbox"
                        class="role-checkbox"
                        value="${role.id}"
                    />
                    <span class="font-medium">${role.name}</span>
                `;

                rolesContainer.appendChild(label);
            });

        } catch (error) {
            console.error("Erreur chargement rôles :", error);
            rolesContainer.innerHTML =
                "<p class='text-red-600 text-sm'>❌ Impossible de charger les rôles</p>";
        }
    }

    await loadRoles();

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        result.textContent = "";
        result.className = "";

        submitBtn.disabled = true;
        submitBtn.textContent = "Traitement...";

        const formData = new FormData(form);

        
        const roles = Array.from(
            document.querySelectorAll(".role-checkbox:checked")
        ).map(cb => parseInt(cb.value, 10));

        if (roles.length === 0) {
            result.textContent = " Sélectionnez au moins un rôle.";
            result.className = "text-red-600 font-medium";
            submitBtn.disabled = false;
            submitBtn.textContent = "Créer l’utilisateur";
            return;
        }

        const payload = {
    first_name: formData.get("first_name")?.trim(),
    middle_name: formData.get("middle_name")?.trim(),
    last_name: formData.get("last_name")?.trim(),
    email: formData.get("email")?.trim(),
    mode: formData.get("mode"), 
    user_type: formData.get("user_type"), 
    roles: roles
};

        try {
            await apiRequest("/api/school/users/", "POST", payload);

            result.textContent =
                payload.mode === "invite"
                    ? " Invitation envoyée avec succès"
                    : " Utilisateur créé avec succès (mot de passe envoyé par email)";

            result.className = "text-green-600 font-medium";

            form.reset();

            const preview = document.getElementById("photoPreview");
            if (preview) preview.classList.add("hidden");

        } catch (error) {
            console.error("Erreur création utilisateur :", error);

            result.textContent =
                " " + (error?.message || "Erreur serveur");

            result.className = "text-red-600 font-medium";

        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Créer l’utilisateur";
        }
    });
});
