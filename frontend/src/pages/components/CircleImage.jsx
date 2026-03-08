export default function CircleImage({ src, alt, className }) {
  return (
    <div className={`rounded-full overflow-hidden shadow-lg ${className}`}>
      <img
        src={src}
        alt={alt || "circle image"}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
