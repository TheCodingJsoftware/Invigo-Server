import { TagAttributesData } from "./tag-attribute";
import { TagStatusData } from "./tag-status";

export interface TagData {
  attribute: TagAttributesData;
  statuses: Record<string, TagStatusData>;
}
