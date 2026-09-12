import { styles } from "./styles";

/**
 * The enquiry status chip, tinted for the status.
 *
 * It returns the whole pill rather than a tint to add to a base class: two
 * class strings both setting a background and a colour would leave the winner
 * to their order in the generated sheet.
 */
export function statusClass(status: string): string {
  if (status === "new") return styles.statusNew;
  if (status === "confirmed") return styles.statusConfirmed;
  if (status === "lost") return styles.statusLost;
  return styles.status;
}
