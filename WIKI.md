# Wiki

## Components Inventory

A database of all components in inventory.

### How do I add the same component to different categories?

***NOTE***: This is different from pressing **Add New Component to Inventory**

1. Select your components
2. Right click
3. Press **Copy to XYZ**.

This will ensure your component will always have the same information accross all categories except for unit quantity, which is unique to each category.

## Laser Cut Inventory

A database of all laser cut parts in inventory.

### How do I add the same laser cut parts to different categories?

1. Select your parts
2. Right click
3. Press **Copy to XYZ**.

This will ensure your component will always have the same information accross all categories except for unit quantity, which is unique to each category.

## Purchase Orders

### How do I add a purchase order template?

Look for **Purchase Orders** on the main toolbar, then press **Add Purchase Order Template**

You will be prompted to select a .xlsx file.

### Where are my templates saved?

Look for **Purchase Orders** on the main toolbar, then press **Open Folder**

## Job Planner & Job Quoter

### How do I plan a job?

To edit a job within Job Planner the job's status needs to be set to **Planning**.

### How do I quote a job?

To view a job within Job Quoter the job's status needs to be set to either **Quoting** or **Quoted**.

### What is the difference between planning and quoting a job?

Jobs have to be created inside **Job Planner** because assemblies and laser cut parts need to have a flow tag. Quoting a job is not required provided all laser cut parts already exist in **Laser Cut Inventory**. (If a part does not exist in the inventory, the row will be highlighted with a red color)

### How do I had a laser cut part to laser cut inventory?

You need to load a nest that contains said part to update its information and then the job needs to be run through workspace. Each process (flow tag) in **Workspace Settings > Edit Flow Tags** has a **Add to inventory** and **Remove from inventory** checkbox which dictates when a laser cut part is added or removed from the inventory.

### What are templates used for?

Typically a job marked as template signifies its ready to be used in **Workspace**; That is, its planned and quoted already.

You can only send a job into workspace if and only if (1) the job is a template and (2) your currently viewing the job.
