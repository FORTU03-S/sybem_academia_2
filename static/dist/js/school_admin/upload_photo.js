const photoInput = document.getElementById("photoInput");
const preview = document.getElementById("photoPreview");

photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) return;

    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
});
