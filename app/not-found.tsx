import Link from "next/link";
export default function NotFound() {
  return <div className="page"><section className="gp pad"><h1 className="title">Nothing forged here</h1><p>That page does not exist. <Link href="/" style={{ color: "var(--acc)" }}>Back to the calculator</Link>.</p></section></div>;
}
