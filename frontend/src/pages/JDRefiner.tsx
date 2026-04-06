import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Download, Copy } from 'lucide-react';
import { jdApi } from '../api/client';

const JDRefiner = () => {
  const [rawRequirements, setRawRequirements] = useState('');
  const [refinedJD, setRefinedJD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleRefine = async () => {
    if (!rawRequirements) return;
    setLoading(true);
    try {
      const response = await jdApi.refine(rawRequirements);
      setRefinedJD(response.data);
    } catch (error) {
      console.error('Refinement failed', error);
      alert('Refinement failed. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const el = document.getElementById('printable-jd');
    if (el) {
      navigator.clipboard.writeText(el.innerText);
      alert('JD Copied to clipboard!');
    }
  };

  const handleExport = () => {
    const content = document.getElementById('printable-jd');
    if (!content) return;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Get Tailwind classes or injected styles
    const styles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(tag => tag.outerHTML)
      .join('');

    const printDoc = iframe.contentWindow?.document;
    if (printDoc) {
      printDoc.open();
      printDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>JD Export</title>
            ${styles}
            <style>
              @page { size: A4 portrait; margin: 15mm; }
              html, body {
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              table { width: 100%; page-break-inside: auto; border-collapse: collapse; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              td, th { page-break-inside: avoid; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body class="bg-white text-black p-8">
            <div class="${content.className}">
              ${content.innerHTML}
            </div>
          </body>
        </html>
      `);
      printDoc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-7xl mx-auto pb-20 print:pb-0 print:gap-0">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles size={16} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]">LLM Layer (Groq GPT-OSS 120B)</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">JD Standardizer</h2>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        {/* Input Panel */}
        <div className="premium-card flex flex-col gap-6 p-6 md:p-8 print:hidden">
          <div className="flex items-center gap-2 pb-4 border-b border-white/5">
            <div className="w-2 h-2 rounded-full bg-secondary" />
            <h3 className="font-bold text-sm tracking-tight text-secondary/40">INPUT_REQUIREMENTS</h3>
          </div>
          <textarea
            className="flex-1 w-full min-h-[300px] lg:min-h-[400px] bg-transparent text-secondary font-mono text-sm leading-relaxed outline-none resize-none scrollbar-hide"
            placeholder="Paste raw requirements..."
            value={rawRequirements}
            onChange={(e) => setRawRequirements(e.target.value)}
          />
          <button
            className="w-full bg-white text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:bg-white/90 disabled:opacity-50"
            onClick={handleRefine}
            disabled={!rawRequirements || loading}
          >
            {loading ? "PROCESSING..." : "GENERATE PREMIUM JD"}
          </button>
        </div>

        {/* Output Panel */}
        <div className="premium-card flex flex-col bg-black/40 border-accent/20 print:bg-transparent print:border-none print:shadow-none print:p-0 print:col-span-2">
          {refinedJD && (
            <div className="flex items-center justify-between p-4 border-b border-accent/10 print:hidden bg-black/40 rounded-t-xl">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <h3 className="font-bold text-sm tracking-tight text-accent">REFINED_JD_DOCUMENT</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                >
                  <Copy size={14} /> Copy
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-black bg-white hover:bg-white/90 rounded-lg transition-colors cursor-pointer"
                >
                  <Download size={14} /> Export PDF
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto max-h-[800px] print:max-h-none print:overflow-visible scrollbar-hide bg-white md:m-4 rounded-xl print:m-0 print:rounded-none">
            {refinedJD ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                id="printable-jd"
                className="text-black font-serif print:w-full print:max-w-none max-w-[210mm] mx-auto p-8 print:p-0 text-[12px] leading-relaxed relative bg-white min-h-[297mm]"
              >
                {/* Print styles handled by iframe export isolating the view */}

                {/* Logo and Header */}
                <div className="flex flex-col mb-6">
                  <div className="flex items-center mb-8">
                    <img src="/avighna.webp" alt="Avighna Logo" className="h-8 md:h-10 object-contain print:h-10" />
                  </div>

                  <h3 className="font-bold text-xs uppercase mb-2">ABOUT US:</h3>
                  <div contentEditable suppressContentEditableWarning className="outline-none focus:bg-gray-50 p-1 -ml-1 rounded transition-colors">
                    <p className="mb-3 text-justify">
                      Avighna is a distinguished real estate development firm specializing in luxury properties in Mumbai's prime locations. Our portfolio showcases high-end residential and commercial projects, setting benchmarks in the industry for luxury and innovation. We are dedicated to creating unparalleled living experiences and sustainable developments that redefine luxury real estate.
                    </p>
                    <p className="mb-3 text-justify">
                      We also have a sizeable investing arm, which focuses on investing in Public Markets, Private Markets, Funds (Private Equity, Venture Capital, Mutual Funds) and direct co-investing in Early-stage to Mid-Stage companies (VC & PE).
                    </p>
                    <p className="mb-4 text-justify">
                      The consortium of companies is under the astute and professional management of Indian promoters who bring a wealth of expertise and experience to the helm. The hands-on approach of the Indian promoters reflects a dedication to upholding the highest standards of corporate governance, thus establishing a solid foundation for the success and longevity of the entire conglomerate.
                    </p>
                  </div>
                </div>

                {/* Job Description Title */}
                <div className="text-center mb-6">
                  <h2 className="font-bold text-base uppercase underline tracking-wider">JOB DESCRIPTION</h2>
                </div>

                {/* Job Details Table */}
                <table className="w-full mb-6 border border-black border-collapse">
                  <tbody>
                    <tr>
                      <th className="border border-black p-2 text-left w-1/4 font-bold align-top">Department:</th>
                      <td className="border border-black p-2 outline-none focus:bg-gray-50 align-top" contentEditable suppressContentEditableWarning>Architecture and ID</td>
                    </tr>
                    <tr>
                      <th className="border border-black p-2 text-left font-bold align-top">Location:</th>
                      <td className="border border-black p-2 outline-none focus:bg-gray-50 align-top" contentEditable suppressContentEditableWarning>Worli, Mumbai</td>
                    </tr>
                    <tr>
                      <th className="border border-black p-2 text-left font-bold align-top">Job Title:</th>
                      <td className="border border-black p-2 outline-none focus:bg-gray-50 align-top font-bold" contentEditable suppressContentEditableWarning>{refinedJD.job_title}</td>
                    </tr>
                    <tr>
                      <th className="border border-black p-2 text-left font-bold align-top">Reports to:</th>
                      <td className="border border-black p-2 outline-none focus:bg-gray-50 align-top" contentEditable suppressContentEditableWarning>Head of Architecture & ID</td>
                    </tr>
                  </tbody>
                </table>

                {/* Job Summary */}
                <div className="mb-6">
                  <div className="font-bold border border-black border-b-0 p-2 uppercase bg-gray-50/50">Job Summary</div>
                  <div className="border border-black p-3 outline-none focus:bg-gray-50 text-justify min-h-[60px]" contentEditable suppressContentEditableWarning>
                    {refinedJD.role_summary}
                  </div>
                </div>

                {/* Qualifications */}
                <div className="mb-6">
                  <div className="font-bold border border-black border-b-0 p-2 uppercase bg-gray-50/50">Qualifications, Experience and Skills</div>
                  <div className="border border-black p-3 pr-6 outline-none focus:bg-gray-50 min-h-[100px]" contentEditable suppressContentEditableWarning>
                    <ul className="list-disc pl-5 space-y-3">
                      {refinedJD.experience_required && (
                        <li>{refinedJD.experience_required}</li>
                      )}
                      {refinedJD.must_have_skills?.length > 0 && (
                        <li>{refinedJD.must_have_skills.join(", ")}</li>
                      )}
                      {refinedJD.preferred_skills?.length > 0 && (
                        <li>{refinedJD.preferred_skills.join(", ")}</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Responsibilities */}
                <div className="mb-6">
                  <div className="font-bold border border-black border-b-0 p-2 uppercase bg-gray-50/50">Roles and Responsibilities</div>
                  <div className="border border-black p-3 pr-6 outline-none focus:bg-gray-50 min-h-[200px]" contentEditable suppressContentEditableWarning>
                    <ul className="list-disc pl-5 space-y-3">
                      {refinedJD.responsibilities?.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-20 bg-black min-h-[400px]">
                <Sparkles size={48} className="mb-4 text-white" />
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white">Awaiting JD Transformation</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JDRefiner;
