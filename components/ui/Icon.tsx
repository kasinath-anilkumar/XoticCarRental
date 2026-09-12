import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  ArrowUDownLeft,
  Calculator,
  Car,
  CaretLeft,
  CaretRight,
  CarProfile,
  ChatTeardropText,
  Check,
  CheckCircle,
  Checks,
  Copy,
  Crown,
  City,
  Clock,
  ClockClockwise,
  ClockUser,
  Crosshair,
  CurrencyInr,
  Flag,
  GasPump,
  GearSix,
  Headset,
  Heart,
  Info,
  Lightning,
  List,
  LockSimple,
  MagnifyingGlass,
  MagnifyingGlassPlus,
  MapPin,
  MapPinLine,
  Minus,
  MoonStars,
  Mountains,
  PhoneCall,
  PlusCircle,
  Receipt,
  RoadHorizon,
  SealCheck,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  StarFour,
  SteeringWheel,
  SuitcaseRolling,
  UserCircleCheck,
  UsersThree,
  WhatsappLogo,
  X,
  AirplaneTilt,
  ArrowsDownUp,
  Buildings,
  CalendarBlank,
  CaretDown,
  CaretUp,
  Certificate,
  Confetti,
  FunnelSimple,
  Path,
  Question,
  Quotes,
  Sparkle,
  SquaresFour,
  Timer,
  Wallet,
  WarningCircle,
  NavigationArrow,
  CurrencyCircleDollar,
  MapTrifold,
  Train,
  AirplaneTakeoff,
  Briefcase,
  Camera,
  CarSimple,
  ChatCircleText,
  ClockCountdown,
  EnvelopeSimple,
  Package,
  PaperPlaneTilt,
  SunHorizon,
  UserFocus,
} from "@phosphor-icons/react/ssr";
import type { CSSProperties } from "react";

/**
 * Phosphor icons, addressed by the `ph-*` names the design and the database
 * use. Content rows carry an icon name as a string (an occasion's `ph-heart`,
 * a "why us" item's `ph-shield-check`), so the lookup has to be by name — but
 * the map keeps it to a fixed, tree-shakeable set rather than a dynamic import.
 *
 * The `/ssr` entry point is deliberate: the default export reads React context
 * for its theming, which would force every icon — and so every page that shows
 * one — into a client bundle. The SSR build renders a plain <svg>.
 */
const ICONS = {
  "ph-arrow-left": ArrowLeft,
  "ph-car": Car,
  "ph-caret-left": CaretLeft,
  "ph-checks": Checks,
  "ph-copy": Copy,
  "ph-crown": Crown,
  "ph-magnifying-glass-plus": MagnifyingGlassPlus,
  "ph-plus-circle": PlusCircle,
  "ph-squares-four": SquaresFour,
  "ph-airplane-takeoff": AirplaneTakeoff,
  "ph-arrow-right": ArrowRight,
  "ph-briefcase": Briefcase,
  "ph-camera": Camera,
  "ph-car-simple": CarSimple,
  "ph-chat-circle-text": ChatCircleText,
  "ph-clock-countdown": ClockCountdown,
  "ph-envelope-simple": EnvelopeSimple,
  "ph-package": Package,
  "ph-paper-plane-tilt": PaperPlaneTilt,
  "ph-sun-horizon": SunHorizon,
  "ph-user-focus": UserFocus,
  "ph-arrow-u-down-left": ArrowUDownLeft,
  "ph-arrows-clockwise": ArrowsClockwise,
  "ph-calculator": Calculator,
  "ph-car-profile": CarProfile,
  "ph-caret-right": CaretRight,
  "ph-chat-teardrop-text": ChatTeardropText,
  "ph-check": Check,
  "ph-check-circle": CheckCircle,
  "ph-city": City,
  "ph-clock": Clock,
  "ph-clock-clockwise": ClockClockwise,
  "ph-clock-user": ClockUser,
  "ph-crosshair": Crosshair,
  "ph-currency-inr": CurrencyInr,
  "ph-flag": Flag,
  "ph-gas-pump": GasPump,
  "ph-gear-six": GearSix,
  "ph-headset": Headset,
  "ph-heart": Heart,
  "ph-info": Info,
  "ph-lightning": Lightning,
  "ph-list": List,
  "ph-lock-simple": LockSimple,
  "ph-magnifying-glass": MagnifyingGlass,
  "ph-map-pin": MapPin,
  "ph-map-pin-line": MapPinLine,
  "ph-minus": Minus,
  "ph-moon-stars": MoonStars,
  "ph-mountains": Mountains,
  "ph-phone-call": PhoneCall,
  "ph-receipt": Receipt,
  "ph-road-horizon": RoadHorizon,
  "ph-seal-check": SealCheck,
  "ph-shield-check": ShieldCheck,
  "ph-sliders-horizontal": SlidersHorizontal,
  "ph-star": Star,
  "ph-star-four": StarFour,
  "ph-steering-wheel": SteeringWheel,
  "ph-suitcase-rolling": SuitcaseRolling,
  "ph-user-circle-check": UserCircleCheck,
  "ph-users-three": UsersThree,
  "ph-whatsapp-logo": WhatsappLogo,
  "ph-x": X,
  "ph-airplane-tilt": AirplaneTilt,
  "ph-arrows-down-up": ArrowsDownUp,
  "ph-buildings": Buildings,
  "ph-calendar-blank": CalendarBlank,
  "ph-caret-down": CaretDown,
  "ph-caret-up": CaretUp,
  "ph-certificate": Certificate,
  "ph-confetti": Confetti,
  "ph-funnel-simple": FunnelSimple,
  "ph-path": Path,
  "ph-question": Question,
  "ph-quotes": Quotes,
  "ph-sparkle": Sparkle,
  "ph-timer": Timer,
  "ph-wallet": Wallet,
  "ph-warning-circle": WarningCircle,
  "ph-navigation-arrow": NavigationArrow,
  "ph-currency-circle-dollar": CurrencyCircleDollar,
  "ph-map-trifold": MapTrifold,
  "ph-train": Train,
} as const;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: string;
  /** px, matching the design's literal icon sizes. */
  size?: number;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, weight = "regular", color, className, style }: IconProps) {
  const Component = ICONS[name as IconName];
  // An unknown name means content referenced an icon nobody imported. Render
  // nothing rather than breaking the layout around it.
  if (!Component) return null;

  return (
    <Component
      size={size}
      weight={weight}
      color={color}
      className={className}
      style={style}
      aria-hidden
    />
  );
}
