"use client";

import Image from "next/image";

const members = [
  { name: "John Doe", designation: "Chairperson", img: "/images/governance/john.jpg" },
  { name: "Jane Smith", designation: "Vice Chairperson", img: "/images/governance/jane.jpg" },
  { name: "Robert Brown", designation: "Treasurer", img: "/images/governance/robert.jpg" },
];

export default function GoverningBodyPage() {
  return (
    <section className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Governing Body</h1>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">#</th>
            <th className="border p-2 text-left">Member</th>
            <th className="border p-2 text-left">Designation</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="border p-2">{idx + 1}</td>
              <td className="border p-2 flex items-center gap-2">
                <Image src={m.img} alt={m.name} width={40} height={40} className="rounded-full" />
                <span>{m.name}</span>
              </td>
              <td className="border p-2">{m.designation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
