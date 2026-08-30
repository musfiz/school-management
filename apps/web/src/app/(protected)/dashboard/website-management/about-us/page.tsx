"use client";

import Image from "next/image";

export default function AboutUsPage() {
  return (
    <section className="p-6">
      {/* Top section: image left, text right */}
      <div className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-start">
        <div className="md:w-1/2">
          <Image
            src="/images/about-us.jpg"
            alt="About us"
            width={600}
            height={400}
            className="rounded-md object-cover"
          />
        </div>
        <div className="md:w-1/2">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">About Us</h1>
          <p className="text-gray-700">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla euismod, nisi vel
            consectetur interdum, nisl nisi aliquet nunc, a placerat risus elit a tortor.
            Cras quis est in nunc elementum blandit. Suspendisse potenti. Maecenas auctor
            erat nec odio laoreet, at tristique orci volutpat.
          </p>
        </div>
      </div>

      {/* Bottom section – additional description */}
      <div className="text-gray-700">
        <p>
          Duis sit amet semper eros. Proin non tempor turpis. Vivamus congue, erat et
          interdum lacinia, justo lectus dictum augue, at commodo mauris nisi in urna.
          Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere
          cubilia curae; Aliquam erat volutpat.
        </p>
      </div>
    </section>
  );
}
