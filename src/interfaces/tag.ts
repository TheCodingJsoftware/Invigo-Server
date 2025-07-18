import { TagAttributesData } from "@interfaces/tag-attribute";
import { TagStatusData } from "@interfaces/tag-status";

export interface TagData {
  attribute: TagAttributesData;
  statuses: Record<string, TagStatusData>;
}
