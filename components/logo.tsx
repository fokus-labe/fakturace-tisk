import Image from "next/image";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export function Logo({
  width = 80,
  height = 60,
  className = "",
  priority = false,
}: LogoProps) {
  return (
    <Image
      src="/logo-fokus-tisk.png"
      alt="Fokus tisk"
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
