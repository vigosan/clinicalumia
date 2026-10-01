import { expect, type Locator } from "@playwright/test";

export async function selectOption(
  trigger: Locator,
  option: string | { label: string },
) {
  await trigger.click();
  const listbox = trigger.page().getByRole("listbox");
  const item =
    typeof option === "string"
      ? listbox.getByTestId(`option-${option}`)
      : listbox.getByRole("option", { name: option.label, exact: true });
  await item.click();
  await expect(listbox).toBeHidden();
}
