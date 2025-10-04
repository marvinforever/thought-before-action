import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, Video, Mic, GraduationCap, FileText } from "lucide-react";

interface ContentTypeFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function ContentTypeFilter({ value, onChange }: ContentTypeFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="All Types" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Types</SelectItem>
        <SelectItem value="book">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Books
          </div>
        </SelectItem>
        <SelectItem value="video">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Videos
          </div>
        </SelectItem>
        <SelectItem value="podcast">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Podcasts
          </div>
        </SelectItem>
        <SelectItem value="course">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Courses
          </div>
        </SelectItem>
        <SelectItem value="article">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Articles
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
