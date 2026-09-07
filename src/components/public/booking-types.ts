export interface BookingService {
  id: string;
  name: string;
  duration: number;
  price: number;
  imageUrl: string | null;
}

export interface BookingProfessional {
  id: string;
  name: string;
  imageUrl: string | null;
  serviceIds: string[];
}

export interface AvailabilitySlot {
  startTime: string;
  label: string;
}

export type BookingStep = "service-professional" | "datetime" | "customer";
