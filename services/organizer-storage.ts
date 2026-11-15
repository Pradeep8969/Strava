// Organizer-only storage. Recorded workouts continue using their existing service.
export {
  getValue as readOrganizerValue,
  setValue as writeOrganizerValue,
} from "./database";
