import Image from "next/image";
import VideoUploader from "./components/VideoUploader";

export default function Home() {
    return (
        <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-[#0A0D14]">
            <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-[#0A0D14] sm:items-start">
                <VideoUploader />
            </main>
        </div>
    );
}
