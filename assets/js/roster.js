import { creators } from "../data/creators.js";

const list = document.querySelector("[data-roster]");
const choices = document.querySelector("[data-creator-choices]");
if (!list || !choices) {
  // Not the roster page.
} else {
  const fragment = document.createDocumentFragment();
  const choiceFragment = document.createDocumentFragment();

  for (const creator of creators) {
    const card = document.createElement("article");
    card.className = "card roster-card";
    card.dataset.creatorId = creator.id;

    const photo = document.createElement("div");
    photo.className = "roster-photo";
    photo.setAttribute("role", "img");
    photo.setAttribute("aria-label", "Photo placeholder");
    photo.textContent = "Photo placeholder";

    const flag = document.createElement("span");
    flag.className = "num";
    flag.textContent = "Placeholder";
    flag.title = creator.placeholderLabel;

    const title = document.createElement("h3");
    title.textContent = creator.niche;

    const platformLabel = document.createElement("span");
    platformLabel.className = "num";
    platformLabel.textContent = "Platforms";

    const platform = document.createElement("p");
    platform.textContent = creator.platforms.join(", ");

    const audienceLabel = document.createElement("span");
    audienceLabel.className = "num";
    audienceLabel.textContent = "Audience";

    const audience = document.createElement("p");
    audience.textContent = creator.audience;

    card.append(photo, flag, title, platformLabel, platform, audienceLabel, audience);
    fragment.append(card);

    const label = document.createElement("label");
    label.className = "check-pill";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "creators";
    input.value = creator.id;
    const text = document.createElement("span");
    text.textContent = `${creator.niche} (placeholder)`;
    label.append(input, text);
    choiceFragment.append(label);
  }

  list.replaceChildren(fragment);
  choices.replaceChildren(choiceFragment);

  choices.addEventListener("change", () => {
    choices.querySelectorAll('input[name="creators"]').forEach((box) => {
      box.setCustomValidity("");
    });
  });
}
